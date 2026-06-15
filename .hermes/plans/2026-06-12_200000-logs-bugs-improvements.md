# Logs Page — Bug Fixes & Improvements Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Revisar y corregir todos los bugs visuales y funcionales de la página de Logs, y mejorar su UX con auto-scroll, persistencia de filtros, mejor rendering, y adaptación completa al tema.

**Architecture:** El LogViewer es un componente Vue 3 con PrimeVue. Los bugs principales son: colores que no se adaptan al theme, `text-muted` con variable incorrecta (`--ft-navbar-muted` en vez de `--ft-text-muted`), hover implementado con JS inline (costoso), `levelBgColors` con clases Tailwind fijas, y auto-scroll deficiente.

**Tech Stack:** Vue 3 + PrimeVue + Tailwind v4 + CSS custom properties

---
## Bugs identificados

1. **`text-muted` usa variable incorrecta**: `--ft-navbar-muted` en vez de `--ft-text-muted`. En light theme, navbar tiene fondo blanco y su muted es gris claro, mientras el texto en la página necesita `--ft-text-muted`.
2. **`levelBgColors` con clases Tailwind fijas**: `bg-surface-600/10`, `bg-sky-500/8`, etc. no se adaptan al dark/light theme. Deben usar CSS variables.
3. **Hover en filas con JS inline**: `@mouseenter`/`@mouseleave` asignando `style.background` es ineficiente. Debe ser CSS puro con `:hover` y variable CSS.
4. **`text-muted` en template**: Las referencias `text-muted` son clases que dependen de la definición global, mezcladas con estilos inline. Debe unificarse.
5. **Auto-scroll no funciona en primera carga**: `scrollToBottom()` llamado en `onMounted` pero los logs pueden no haberse renderizado aún. Usar `nextTick` + `watch` sobre `filteredLogs`.
6. **`ToggleSwitch` sin import**: Puede no estar auto-importado. Verificar que `ToggleSwitch` esté registrado.
7. **Separador `·` hardcodeado**: Los separadores en el contador de logs usan `·` (middle dot) que puede no renderizarse bien en todos los browsers.
8. **Fondo del log container**: Usa `--ft-bg-muted` que en light theme puede ser casi blanco — la diferencia con el fondo de la página puede ser imperceptible.
9. **`levelBgColors` no se usa con filtros**: La opacidad `opacity-40` se combina con `levelBgColors` de forma confusa. Cuando no hay filtro activo, todos los badges tienen bg pero cuando hay filtro, los no seleccionados tienen opacidad 40% (se ven mal).
10. **Módulo/logger truncado**: `max-w-[8rem]` puede cortar nombres de módulo largos sin manera de ver el completo (tiene `:title` pero es incómodo en mobile).
11. **Sin indicador de carga**: No hay feedback visual mientras se cargan los logs.

---
## Task breakdown

### Task 1: Corregir `text-muted` y unificar colores del tema

**Objective:** Cambiar `.text-muted` a `--ft-text-muted` y reemplazar todas las clases de color Tailwind fijas por CSS variables.

**Files:**
- Modify: `src/styles/tailwind.css:374-376`
- Modify: `src/components/ftbot/LogViewer.vue:16-30`

**Step 1: Fix `.text-muted` in tailwind.css**

Change:
```css
.text-muted {
  color: var(--ft-navbar-muted);
}
```
To:
```css
.text-muted {
  color: var(--ft-text-muted);
}
```

**Step 2: Replace `levelColors` hardcoded Tailwind classes**

In `LogViewer.vue`, change:
```ts
const levelColors: Record<string, string> = {
  DEBUG: 'text-[var(--ft-text-muted)]',
  INFO: 'text-[var(--p-primary-color)]',
  WARNING: 'text-amber-400',
  ERROR: 'text-red-400',
  CRITICAL: 'text-red-500 font-bold',
};
```
To (using only CSS variables):
```ts
const levelColors: Record<string, string> = {
  DEBUG: 'text-[var(--ft-text-muted)]',
  INFO: 'text-[var(--p-primary-color)]',
  WARNING: 'text-[var(--ft-warning)]',
  ERROR: 'text-[var(--ft-error)]',
  CRITICAL: 'text-[var(--ft-error)] font-bold',
};
```

And add the CSS variables in tailwind.css `:root` and `.ft-dark-theme`:

In `:root` block:
```css
--ft-warning: #d97706;
--ft-error: #dc2626;
```

In `.ft-dark-theme` block:
```css
--ft-warning: #fbbf24;
--ft-error: #ef4444;
```

Or simpler: just use the existing `--color-profit` / `--color-loss` variables or define them directly.

**Step 3: Replace `levelBgColors` Tailwind classes**

Change from Tailwind classes to CSS variables:
```ts
const levelBgColors: Record<string, string> = {
  DEBUG: 'bg-[color-mix(in_srgb,var(--ft-text-muted)_10%,transparent)]',
  INFO: 'bg-[color-mix(in_srgb,var(--p-primary-color)_12%,transparent)]',
  WARNING: 'bg-[color-mix(in_srgb,var(--ft-warning)_14%,transparent)]',
  ERROR: 'bg-[color-mix(in_srgb,var(--ft-error)_16%,transparent)]',
  CRITICAL: 'bg-[color-mix(in_srgb,var(--ft-error)_24%,transparent)]',
};
```

But Tailwind's arbitrary value with `color-mix` may not work well. A simpler approach is to use inline `:style` with CSS variables when rendering the badges, or define CSS classes for each level.

Better approach — use CSS-only badges with `:style`:
```vue
:style="{
  background: levelFilter.length === 0 || levelFilter.includes(level)
    ? `color-mix(in srgb, var(--ft-badge-${level.toLowerCase()}) 14%, transparent)`
    : 'transparent',
  borderColor: levelFilter.length === 0 || levelFilter.includes(level)
    ? `color-mix(in srgb, var(--ft-badge-${level.toLowerCase()}) 30%, transparent)`
    : 'var(--ft-panel-border)',
}"
```

Then define `--ft-badge-*` in CSS:
```css
--ft-badge-debug: var(--ft-text-muted);
--ft-badge-info: var(--p-primary-color);
--ft-badge-warning: #f59e0b;
--ft-badge-error: #ef4444;
--ft-badge-critical: #ef4444;
```

**Verify:**
Build and test theme switching:
```
export PATH="/usr/lib/node_modules/corepack/shims:$PATH" && pnpm run build
```

---

### Task 2: Eliminar hover JS inline, usar CSS puro

**Objective:** Reemplazar los handlers `@mouseenter`/`@mouseleave` con CSS `:hover` y variable.

**Files:**
- Modify: `src/components/ftbot/LogViewer.vue:218-224`

**Step 1:** Remove the `@mouseenter` and `@mouseleave` handlers from the log entry div.

**Step 2:** Add the hover style to the scoped CSS:

```css
.log-entry:hover {
  background: var(--ft-navbar-hover-bg) !important;
}
```

**Verify:** Build passes.

---

### Task 3: Mejorar auto-scroll con watch reactivo

**Objective:** Asegurar que el scroll al fondo funcione cuando los logs cambian, no solo en mount.

**Files:**
- Modify: `src/components/ftbot/LogViewer.vue:75-101`

**Step 1:** Replace the current `scrollToBottom()` call in `onMounted` and add a `watch`:

```ts
onMounted(async () => {
  await botStore.activeBot.getLogs();
});

watch(
  () => botStore.activeBot.lastLogs?.length,
  () => {
    nextTick(() => {
      if (scrollContainer.value) {
        scrollContainer.value.scrollTop = scrollContainer.value.scrollHeight;
      }
    });
  },
  { immediate: true },
);
```

Keep `scrollToBottom()` as a function for the button click but simplify it.

**Verify:** Build passes.

---

### Task 4: Fix level filter badges visual

**Objective:** Mejorar la visual de los badges de filtro para que se vean correctos con/sin filtro activo.

**Files:**
- Modify: `src/components/ftbot/LogViewer.vue:124-150`

**Step 1:** Change the badge rendering logic. When no filter is active, all levels should show with their bg color at normal opacity. When a filter IS active, selected levels keep their bg, unselected ones become outline-only (no bg, low opacity).

Current problematic approach:
```vue
:class="{
  'opacity-40': levelFilter.length > 0 && !levelFilter.includes(level),
  [levelBgColors[level]]: levelFilter.length === 0 || levelFilter.includes(level),
}"
```

Replace with `:style`:
```vue
:style="{
  opacity: levelFilter.length > 0 && !levelFilter.includes(level) ? '0.35' : '1',
  background: levelFilter.length === 0 || levelFilter.includes(level)
    ? `color-mix(in srgb, var(--ft-text-muted) 10%, transparent)`
    : 'transparent',
  borderColor: levelFilter.length === 0 || levelFilter.includes(level)
    ? `color-mix(in srgb, var(--p-primary-color) 25%, transparent)`
    : 'var(--ft-panel-border)',
}"
```

**Verify:** Build passes.

---

### Task 5: Agregar indicador de carga

**Objective:** Mostrar un Spinner/ProgressSpinner mientras se cargan los logs.

**Files:**
- Modify: `src/components/ftbot/LogViewer.vue`

**Step 1:** Add a loading ref:
```ts
const loading = ref(false);
```

**Step 2:** Wrap the getLogs call:
```ts
async function refreshLogs() {
  loading.value = true;
  await botStore.activeBot.getLogs();
  loading.value = false;
}
```

**Step 3:** In the template, show a spinner overlay when loading:
```vue
<div v-if="loading" class="flex items-center justify-center h-32">
  <i-mdi-loading class="text-2xl text-muted animate-spin" />
</div>
```

Or simpler — replace the refresh button icon with a spinner when loading.

**Verify:** Build passes.

---

### Task 6: Verificar ToggleSwitch import

**Objective:** Asegurar que `ToggleSwitch` está disponible (auto-import o import manual).

**Files:**
- Inspect: `src/components/ftbot/LogViewer.vue`

**Step 1:** Check if `ToggleSwitch` is auto-imported:
```
grep -n "ToggleSwitch" src/auto-imports.d.ts
```

**Step 2:** If not found, add import:
```ts
import ToggleSwitch from 'primevue/toggleswitch';
```

**Verify:** Build passes.

---

### Task 7: Mejorar truncado del módulo en mobile

**Objective:** En mobile, el nombre del módulo no debe truncarse tan agresivamente.

**Files:**
- Modify: `src/components/ftbot/LogViewer.vue:235-237`

**Step 1:** Change the module name span to expand on mobile:
```vue
<span
  class="text-xs shrink-0 truncate"
  :class="isMobile ? 'max-w-[6rem]' : 'max-w-[10rem]'"
  :title="log[2]"
  :style="{ color: 'var(--ft-text-muted)' }"
>
  {{ log[2] }}
</span>
```

**Verify:** Build passes.

---

### Task 8: Build y deploy final

**Objective:** Build + deploy a producción.

**Step 1: Build**
```bash
export PATH="/usr/lib/node_modules/corepack/shims:$PATH" && pnpm run build
```
Expected: ✓ built in N.Ns

**Step 2: Docker build**
```bash
docker compose build frequi-custom 2>&1 | tail -3
```
Expected: "Image ... Built"

**Step 3: Deploy**
```bash
docker compose up -d frequi-custom
```

---

## Verification checklist

- [ ] Build passes without errors
- [ ] `.text-muted` usa `--ft-text-muted` (no `--ft-navbar-muted`)
- [ ] Log level colors (DEBUG/INFO/WARNING/ERROR) se ven correctos en dark y light theme
- [ ] Hover en filas funciona con CSS, no JS
- [ ] Scroll al fondo funciona al cargar logs y al hacer refresh
- [ ] Badges de filtro se ven correctos: sin filtro todos coloreados, con filtro los no seleccionados se atenúan
- [ ] Loading spinner aparece durante carga
- [ ] ToggleSwitch funciona (auto-refresh)
- [ ] Módulo/logger no se trunca excesivamente en mobile
- [ ] Copy individual y copy all funcionan

---

## Risks and open questions

- **`color-mix` in `:style`**: `color-mix(in srgb, var(--x) N%, transparent)` dentro de `:style` puede no funcionar en todos los navegadores. Safari tiene buen soporte pero versiones antiguas (pre-15.4) no. Alternativa: usar clases CSS predefinidas.
- **ToggleSwitch auto-import**: Si no está en auto-imports, hay que agregar import manual. Esto puede causar error de build si no está registrado.
- **`animate-spin`**: Esta clase de Tailwind puede no estar disponible si no se configuró `@utility`. Verificar.
