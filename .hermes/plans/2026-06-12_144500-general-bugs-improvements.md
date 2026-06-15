# FreqUI — Proyecto: Bugs y Mejoras Generales

> **For Hermes:** Plan mode — analysis only. Use subagent-driven-development for execution.

**Goal:** Identify and fix bugs, dead code, and improvements across the entire FreqUI Vue 3 frontend.

**Architecture:** Vue 3 SPA, Pinia stores, PrimeVue 4 UI, lightweight-charts 5 (main chart) + ECharts 6 (dashboard/balance charts), Vite 8 build, nginx Docker deployment.

**Tech Stack:** Vue 3.5, TypeScript 5.9, Pinia 3, PrimeVue 4, lightweight-charts 5.2, ECharts 6, Vue Router 5, Vite 8, pnpm 10, Docker/nginx Alpine

---

## Bugs

### B1 — nginx.conf `root html;` es frágil

**File:** `nginx.conf:34`

**Problema:** `root html;` es relativo al prefix de nginx (que varía entre imágenes). En la imagen Alpine el prefix es `/etc/nginx/`, por lo que `html` resuelve a `/etc/nginx/html/` — que es donde COPY pone los archivos. Pero funciona por casualidad, no por diseño. La imagen oficial usa `/usr/share/nginx/html`.

**Fix:** 
```nginx
root   /usr/share/nginx/html;
```
(Ajustar el COPY en Dockerfile si es necesario, o viceversa)

---

### B2 — Falta Content-Security-Policy y headers de seguridad

**File:** `nginx.conf`

**Problema:** La SPA se sirve sin ningún header de seguridad (CSP, X-Frame-Options, etc.). Los nombres de estrategias/pares vienen de la API de Freqtrade y podrían contener caracteres maliciosos.

**Fix:** Agregar al bloque `server`:
```nginx
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' http://localhost:8080;" always;
```

---

### B3 — SPA no cachea assets correctamente

**File:** `nginx.conf`

**Problema:** Los archivos JS/CSS del build de Vite tienen hashes en el nombre (ej. `index-BCccIcDU.js`), pero nginx no tiene cabeceras de caché. El `index.html` debería NO cachearse (para detectar nuevos builds), pero los assets con hash deberían cachearse para siempre.

**Fix:**
```nginx
location /assets/ {
    root   /etc/nginx/html;
    expires 1y;
    add_header Cache-Control "public, immutable";
}
location / {
    root   /etc/nginx/html;
    try_files $uri /index.html;
    expires -1;
    add_header Cache-Control "no-cache, must-revalidate";
}
```

---

## Dead Code (~1268 líneas eliminables)

### DC1 — `CandleChart.vue` (ECharts), 754 líneas

**File:** `src/components/charts/CandleChart.vue`

**Problema:** Es el chart VIEJO basado en ECharts. Ya no es importado por ningún archivo del proyecto — `SingleCandleChartContainer.vue` usa `TradingViewCandleChart.vue` (lightweight-charts). El `CandleChartContainer.vue` solo wrappea `SingleCandleChartContainer`.

**Eliminar:** `src/components/charts/CandleChart.vue`

---

### DC2 — `tradeChartData.ts`, 352 líneas

**File:** `src/utils/charts/tradeChartData.ts`

**Problema:** Solo es importado por `CandleChart.vue` (DC1). Contiene `generateTradeSeries`, `generateMarkArea`, `generateMarkAreaSeries`.

**Eliminar:** `src/utils/charts/tradeChartData.ts`
**Nota:** También limpiar las referencias en `src/auto-imports.d.ts`.

---

### DC3 — `candleChartSeries.ts`, 75 líneas

**File:** `src/utils/charts/candleChartSeries.ts`

**Problema:** Solo importado por `CandleChart.vue`. Contiene `generateCandleSeries`, `generateAreaCandleSeries`.

**Eliminar:** `src/utils/charts/candleChartSeries.ts`

---

### DC4 — `areaPlotDataset.ts`, 54 líneas

**File:** `src/utils/charts/areaPlotDataset.ts`

**Problema:** Solo importado por `CandleChart.vue`. Contiene `calculateDiff`, `getDiffColumnsFromPlotConfig`.

**Eliminar:** `src/utils/charts/areaPlotDataset.ts`

---

### DC5 — Limpiar `auto-imports.d.ts`

**File:** `src/auto-imports.d.ts`

**Problema:** Este archivo es GENERADO automáticamente por `unplugin-auto-imports`. Tiene referencias a funciones de los archivos DC2-DC4 que ya no existen. Al eliminar los archivos fuente, el auto-imports se regenerará en el próximo build automáticamente. Pero hay que verificar que no haya errores de compilación.

**Fix:** Ejecutar `pnpm run build` después de eliminar los archivos para regenerar `auto-imports.d.ts`.

---

## Mejoras

### I1 — Store `ftbot.ts` tiene 1296 líneas

**File:** `src/stores/ftbot.ts`

**Problema:** Es el store más grande del proyecto (1296 líneas). Mezcla lógica de API calls, estado de trades, candles, balance, backtesting, locks, etc. Díficil de mantener y testear.

**Sugerencia:** Dividir en stores más pequeños:
- `src/stores/tradesStore.ts` (trades + orders)
- `src/stores/candleStore.ts` (candleData + history)
- `src/stores/backtestStore.ts` (backtest state)
- Mantener `ftbot.ts` solo para conexión/bots

---

### I2 — Test coverage: 0 tests para chart components

**Files:** `tests/` (solo 10 tests unitarios existentes)

**Problema:** No hay tests unitarios para:
- `TradingViewCandleChart.vue` (la pieza más compleja y modificada)
- `buildTradeMarkers.ts` (lógica de construcción de marcadores)
- `tradeMarkersPrimitive.ts` (renderizado Canvas2D)
- `signalConfigs.ts`
- `CandleChartContainer.vue`
- `SingleCandleChartContainer.vue`

**Sugerencia:** Agregar tests unitarios (vitest) para al menos:
- `buildTradeMarkers.ts` (lógica pura, fácil de testear)
- `signalConfigs.ts` (constantes)
- `tradeMarkersPrimitive.ts` (métodos de dibujo)

---

### I3 — Cache-Control para llamadas API

**File:** `src/composables/api.ts`

**Problema:** Las llamadas a la API de Freqtrade (axios) no tienen configuración de timeout ni retry. Si el bot está caído, la UI se queda cargando indefinidamente.

**Sugerencia:**
```ts
const api = axios.create({
  timeout: 15000,
  // ... otras configs
});
api.interceptors.response.use(undefined, (error) => {
  if (!error.response) {
    // Network error — bot caído
    useAlertsStore().addAlert({ severity: 'error', message: 'Bot no responde' });
  }
  return Promise.reject(error);
});
```

---

### I4 — La ruta `/balance` importa un componente directamente

**File:** `src/router/index.ts:47`

**Problema:** La ruta `/balance` importa `BotBalance.vue` directamente (no lazy):
```ts
component: () => import('@/components/ftbot/BotBalance.vue'),
```
Mientras que todas las otras rutas lazy-load views desde `@/views/`. Es inconsistente pero funcional. No es bloqueante.

---

### I5 — Estilo: multi-line ternarios sin paréntesis

**File:** Varios, especialmente `buildTradeMarkers.ts`, `TradingViewCandleChart.vue`

**Problema:** Hay ternarios multi-line sin paréntesis que son difíciles de leer:
```ts
const label = isFinalExit && isDefined(trade.profit_ratio)
  ? `✕ ${formatPercent(trade.profit_ratio, 2)}`
  : '✕';
```

**Sugerencia:** No crítico, pero aplicar prettier o ESLint `"prettier/prettier": "error"` ayudaría.

---

## Archivos a modificar/crear/eliminar

### Eliminar
| Archivo | Líneas | Razón |
|---|---|---|
| `src/components/charts/CandleChart.vue` | 754 | Dead code (ECharts, no usado) |
| `src/utils/charts/tradeChartData.ts` | 352 | Solo usado por CandleChart.vue |
| `src/utils/charts/candleChartSeries.ts` | 75 | Solo usado por CandleChart.vue |
| `src/utils/charts/areaPlotDataset.ts` | 54 | Solo usado por CandleChart.vue |
| `src/utils/charts/binCount.ts` | — | Verificar si tiene otros usos |

### Modificar
| Archivo | Cambio |
|---|---|
| `nginx.conf` | Fix root path, agregar CSP y cache headers |
| `Dockerfile` | Posiblemente ajustar COPY path |
| `src/composables/api.ts` | Agregar timeout y error handling |
| `src/stores/ftbot.ts` | Refactorizar en stores más pequeños (opcional) |

### Verificar
| Archivo | Qué hacer |
|---|---|
| `src/auto-imports.d.ts` | Se regenera solo, verificar build tras eliminar dead code |

---

## Tasks para ejecución

### Task 1: Limpiar dead code del ECharts antiguo

**Files:**
- Delete: `src/components/charts/CandleChart.vue`
- Delete: `src/utils/charts/tradeChartData.ts`
- Delete: `src/utils/charts/candleChartSeries.ts`
- Delete: `src/utils/charts/areaPlotDataset.ts`
- Verify: `src/utils/charts/binCount.ts` — buscar referencias antes de eliminar

**Steps:**
1. Verificar que ningún archivo importa los que vamos a borrar
2. Borrar los archivos
3. Ejecutar `pnpm run typecheck` (esperar errores de auto-imports)
4. Ejecutar `pnpm run build` (regenera auto-imports.d.ts automáticamente)
5. Verificar que typecheck y build pasan

---

### Task 2: Mejorar nginx.conf

**Files:**
- Modify: `nginx.conf`

**Changes:**
- Cambiar `root html;` por `root /usr/share/nginx/html;`
- Agregar headers de seguridad (CSP, etc.)
- Agregar caché de assets con hash

**Verificación:** `docker compose build frequi-custom && docker compose up -d frequi-custom`

---

### Task 3: Mejorar error handling en api.ts

**Files:**
- Modify: `src/composables/api.ts`

**Changes:**
- Agregar timeout de 15 segundos
- Agregar interceptor de respuesta para errores de red
- Mostrar alerta cuando el bot no responde

**Verificación:** `pnpm run typecheck && pnpm run build`

---

### Task 4: Refactor ftbot.ts (opcional, large effort)

**Files:**
- Create: `src/stores/tradesStore.ts`
- Create: `src/stores/candleStore.ts`
- Modify: `src/stores/ftbot.ts` (reducir)

**Nota:** Esta es una tarea grande y riesgosa por los miles de lugares que importan desde `useBotStore()`. Requiere planificación separada.

---

## Tests / Validación

1. `pnpm run typecheck` — 0 errores
2. `pnpm run build` — build exitoso
3. `docker compose build frequi-custom` — Docker build exitoso
4. Tras deploy: navegar a todas las rutas principales y verificar que no hay 404s
5. Verificar que chart de trading (TradingView) funciona correctamente
6. Verificar que dashboard (AdvancedDashboardView con ECharts) sigue funcionando

## Riesgos

1. **Eliminar dead code puede romper auto-imports**: El build regenera `auto-imports.d.ts`, pero si algún componente usa funciones de los archivos eliminados (y no nos dimos cuenta), el build fallará. Solución: búsqueda exhaustiva con grep antes de borrar.
2. **CSP headers pueden bloquear funcionalidad**: El CSP propuesto puede bloquear conexiones WebSocket o ciertos estilos. Probar en staging primero.
3. **Refactor de ftbot.ts**: Alto riesgo, recomiendo no hacerlo sin tests primero.
