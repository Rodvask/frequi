# FreqUI — Optimización de Carga

> **For Hermes:** Plan mode — no execution. Analysis of loading performance and optimization opportunities.

**Goal:** Reduce JS bundle sizes, enable compression, and improve perceived loading speed.

**Current state:** Total JS ~2.1 MB (uncompressed), ECharts is ~1.1 MB (52% of total), main bundle ~806 KB.

---

## Problemas encontrados

### P1 — gzip no comprime JS/CSS

**File:** `nginx.conf`

**Problema:** `gzip on;` está activado pero nginx por defecto solo comprime HTML, CSS, XML y TXT. No comprime `application/javascript` ni `application/json` ni otros tipos MIME. El JS de 806 KB se sirve sin comprimir.

**Fix:** Agregar `gzip_types` explícito:

```nginx
gzip on;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;
gzip_min_length 1000;
gzip_vary on;
```

**Impacto:** El JS se reduciría ~70-75%: 806 KB → ~200 KB, 609 KB → ~150 KB.

---

### P2 — ECharts es el 52% del JS total

**Problema:** ECharts + vue-echarts generan ~1.1 MB en dos chunks:
- `ftEchartsTransforms-*.js`: 609 KB (incluye ECharts + transforms)
- `installCanvasRenderer-*.js`: 493 KB (ECharts canvas renderer)

Estos chunks se cargan porque las vistas `DashboardView` y `AdvancedDashboardView` usan ECharts. Ya están lazy-loaded por ruta, pero al ser chunks grandes, la primera carga a esas rutas es lenta.

**Opciones:**
1. **Aceptar**: ya están code-split, solo afecta a las rutas que los necesitan
2. **Migrar a lightweight-charts**: gran esfuerzo, reemplazar todas las ECharts charts
3. **Optimizar imports de ECharts**: asegurar tree-shaking (solo importar los módulos necesarios)

---

### P3 — Las imágenes PNG no están optimizadas

**Files:** `src/assets/freqtrade-logo.png` (11 KB), `src/assets/freqtrade-logo-mask.png` (37 KB)

**Problema:** Los PNGs no tienen compresión lossless. Podrían convertirse a WebP o AVIF para reducir tamaño.

**Fix:** Convertir a WebP con `cwebp` o usar `srcset` con `<picture>`. Impacto bajo (~20-30 KB ahorro).

---

### P4 — Las fuentes no tienen `font-display: swap`

**Files:** Las fuentes (Arimo, JetBrains Mono) se cargan desde `@fontsource-variable/arimo` y `@fontsource-variable/jetbrains-mono`.

**Problema:** Si la fuente no se ha cargado aún, el texto es INVISIBLE (FOUT - Flash of Invisible Text) hasta que se descarga. `font-display: swap` mostraría el texto con una fuente del sistema mientras se descarga la fuente personalizada.

**Fix:** Las fuentes de fontsource normalmente ya incluyen `font-display: swap` en su CSS. Verificar que esté configurado.

---

### P5 — No hay indicador de carga para vistas lazy

**Problema:** Todas las rutas usan `() => import(...)` (lazy loading), pero no hay un componente `<Suspense>` o indicador de carga. Al navegar a una ruta, el usuario ve una pantalla en blanco hasta que el chunk se descarga y Vue lo renderiza.

**Fix:** Agregar un Suspense boundary o un indicador de carga en el `RouterView`:

```html
<RouterView v-slot="{ Component }">
  <Suspense>
    <component :is="Component" />
    <template #fallback>
      <div class="flex items-center justify-center h-full">
        <ProgressSpinner />
      </div>
    </template>
  </Suspense>
</RouterView>
```

---

## Tareas

### Task 1: Habilitar gzip para JS/JSON/SVG

**File:** `nginx.conf`

Agregar después de `gzip on;`:
```nginx
gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;
gzip_min_length 1000;
gzip_vary on;
```

**Verificación:** 
```bash
curl -sI -H "Accept-Encoding: gzip" http://localhost:9001/assets/index-*.js | grep Content-Encoding
# Expected: Content-Encoding: gzip
```

### Task 2: Verificar font-display de las fuentes

**Files:** Revisar `node_modules/@fontsource-variable/arimo/files/` y `node_modules/@fontsource-variable/jetbrains-mono/files/` para confirmar que tienen `font-display: swap`.

**Verificación:** Build + inspeccionar CSS generado en dist/.

### Task 3: Agregar indicador de carga en RouterView

**File:** `src/App.vue`

Envolver `RouterView` con Suspense y ProgressSpinner como fallback.

### Task 4: Optimizar imágenes PNG a WebP (opcional)

Convertir:
- `src/assets/freqtrade-logo.png` → WebP
- `src/assets/freqtrade-logo-mask.png` → WebP

---

## Impacto esperado

| Métrica | Antes | Después (estimado) |
|---|---|---|
| JS total descargado | 2.1 MB | ~600 KB (con gzip) |
| Tiempo de carga inicial | ~2-3s | ~0.8-1.2s |
| Tiempo Dashboard (lazy) | ~1.5s + 609 KB | ~1.5s + 150 KB (gzip) |
| Percepción de carga | Pantalla en blanco | Spinner + texto visible |

## Riesgos

1. **gzip**: Consume algo de CPU en el servidor, pero para nginx es mínimo. Beneficio enorme.
2. **Suspense**: Vue 3 Suspense está estable pero puede tener edge cases con componentes que usan `onMounted` con lógica asíncrona.
3. **Migrar ECharts**: No recomendado ahora — gran esfuerzo, bajo impacto relativo.
