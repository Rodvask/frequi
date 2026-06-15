# Menu: Bugs y Mejoras — Desktop & Mobile

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Limpiar bugs visuales, CSS duplicado, y refinar el menú desktop/mobile con un acabado moderno y consistente.

**Architecture:** Los cambios son puramente de template + CSS. No se modifican stores, rutas, ni lógica de negocio. El menú desktop se controla desde `NavBar.vue`, el menú mobile bottom desde `NavFooter.vue`, los estilos desde `tailwind.css`.

**Tech Stack:** Vue 3 + PrimeVue + Tailwind (sin PrimeFlex) + iconos unplugin-icons (MDI)

---
## Current bugs identified

1. **CSS duplicado**: Hay DOS reglas `.ft-nav-link` en `tailwind.css` — la original (line ~519) y la nueva (line ~318). La original tiene `font-weight: 800; border: 1px solid transparent; min-height: 2.25rem`, pisa el nuevo diseño.
2. **`iconComponent` no usado**: Función `iconComponent` en `NavBar.vue:124-137` declarada pero nunca llamada en el template.
3. **Clases CSS huérfanas**: `ft-navbar-actions`, `ft-navbar-refresh-group`, `ft-navbar-bot-status`, `ft-navbar-account-button` ya no se usan (template renovado).
4. **Bot status no tiene estilo definido**: `ft-navbar-status` / `ft-status-dot` / `ft-status-online` / `ft-status-offline` se usan en el template pero no tienen reglas CSS.
5. **`ft-navbar-account-btn` vs `ft-navbar-account-button`**: Template usa clase `ft-navbar-account-btn` pero el CSS targetea `ft-navbar-account-button`.
6. **Mobile bottom nav sin active en ruta `/`**: La homepage (`/`) no tiene nav link activo en el bottom nav porque no hay tab para ella.
7. **Drawer no sincroniza versión**: En el drawer, abajo se muestra `v{{ settingsStore.uiVersion }}` como texto plano, pero el account dropdown muestra `V: ${settingsStore.uiVersion}`.
8. **`border-panel` class**: Template del drawer usa `border-panel` que no es clase Tailwind ni está definida.
9. **`.router-link-active` obsoleto**: Las reglas `.ft-mobile-bottom-nav .router-link-active` (line ~661) ya no aplican porque el bottom nav usa `RouterLink` con clase manual `ft-mobile-nav-item-active`.
10. **`tabs` no reactivo**: En `NavFooter.vue`, `tabs` es un array plano, no `ref` — las propiedades `visible` con `computed` funcionan dentro pero el array en sí no es reactivo. Debe ser `ref`.

---
## Task breakdown

### Task 1: Eliminar CSS duplicado de `.ft-nav-link`

**Objective:** Remover la regla `.ft-nav-link` antigua (lines ~519-540) que pisa el diseño moderno.

**Files:**
- Modify: `src/styles/tailwind.css` (around line 519)

**Step 1: Read and verify duplicate**

Read lines 515-545:
```
grep -n "ft-nav-link" src/styles/tailwind.css
```

Expected: TWO blocks of `.ft-nav-link` rules.

**Step 2: Remove old block**

Delete from the `.ft-nav-link` at line ~519 up to the line before `.ft-nav-link-active` or the next rule. The block to remove includes:

```css
  .ft-nav-link {
    display: inline-flex;
    align-items: center;
    gap: 0.42rem;
    min-height: 2.25rem;
    padding: 0.34rem 0.72rem;
    border: 1px solid transparent;
    border-radius: 0.45rem;
    color: var(--ft-navbar-muted);
    font-size: 0.86rem;
    font-weight: 800;
```

Also remove the `.ft-navbar-bot-status` and `.ft-navbar-account-button` blocks if they exist and are unused.

**Step 3: Verify**

Run:
```
export PATH="/usr/lib/node_modules/corepack/shims:$PATH" && pnpm run build
```
Expected: Build succeeds.

---

### Task 2: Eliminar código muerto en NavBar.vue

**Objective:** Remover `iconComponent` function y clases CSS no usadas.

**Files:**
- Modify: `src/components/layout/NavBar.vue`

**Step 1: Remove `iconComponent`**

Delete lines 124-137 (the entire `iconComponent` function).

**Step 2: Verify no references**

Check with:
```
grep -n "iconComponent" src/components/layout/NavBar.vue
```
Expected: No matches.

**Step 3: Build**

```
export PATH="/usr/lib/node_modules/corepack/shims:$PATH" && pnpm run build
```

---

### Task 3: CSS para bot status y account button

**Objective:** Agregar reglas CSS para los nuevos selectores del template renovado.

**Files:**
- Modify: `src/styles/tailwind.css`

**Add these rules** after the `.ft-navbar-tools` section (after line ~368):

```css
  /* Account button */
  .ft-navbar-account-btn.p-button {
    min-width: 2.6rem;
    min-height: 2rem;
    padding: 0.12rem 0.25rem;
    border: 1px solid var(--ft-panel-border);
    border-radius: 0.5rem;
    background: color-mix(in srgb, var(--ft-panel-strong) 58%, transparent);
    color: var(--ft-navbar-muted);
    transition: border-color 0.2s ease, background 0.2s ease;
  }
  .ft-navbar-account-btn.p-button:hover {
    border-color: var(--ft-navbar-active-border);
    background: var(--ft-navbar-hover-bg);
    color: var(--ft-navbar-active);
  }

  /* Bot status */
  .ft-navbar-status .ft-status-dot {
    font-size: 0.75rem;
    font-weight: 700;
    padding: 0.1rem 0.4rem;
    border-radius: 999px;
  }
  .ft-navbar-status .ft-status-online {
    color: var(--color-profit);
    background: color-mix(in srgb, var(--color-profit) 15%, transparent);
  }
  .ft-navbar-status .ft-status-offline {
    color: var(--color-loss);
    background: color-mix(in srgb, var(--color-loss) 15%, transparent);
  }
```

Also add a rule for the `text-muted` utility (if not already defined):
```css
  .text-muted {
    color: var(--ft-navbar-muted);
  }
```

---

### Task 4: Eliminar CSS huérfano de navbar

**Objective:** Remover reglas CSS que ya no se usan en el template renovado.

**Files:**
- Modify: `src/styles/tailwind.css`

**Remove these blocks:**
1. `.ft-navbar-actions` (line ~374)
2. `.ft-navbar-refresh-group` (line ~379)
3. `.ft-navbar-bot-status` (line ~448)
4. `.ft-navbar-account-button` (line ~468)
5. `.ft-mobile-bottom-nav .router-link-active` (line ~661)

Use `patch` with `mode='replace'` and empty `new_string` to delete each block, or combine into one larger patch string that replaces the entire section.

**Verify:**
```
export PATH="/usr/lib/node_modules/corepack/shims:$PATH" && pnpm run build
```

---

### Task 5: Arreglar border-panel class en Drawer

**Objective:** Reemplazar clase `border-panel` que no existe por la variable CSS correcta.

**Files:**
- Modify: `src/components/layout/NavBar.vue`

**Step 1: Find the class**

Search `border-panel` in NavBar.vue - it's on the drawer divider:

```html
<div class="flex items-center justify-between px-4 py-3 border-b border-panel">
...
<div class="border-t border-panel p-3 flex flex-col gap-3">
```

**Step 2: Replace**

`border-panel` → `border-[var(--ft-panel-border)]`

Or alternatively, define a Tailwind utility class. Better: use inline style or define the class in tailwind.css if it's used in many places.

Simplest fix: replace with the CSS variable:
```html
border-b border-[var(--ft-panel-border)]
border-t border-[var(--ft-panel-border)]
```

---

### Task 6: NavFooter — hacer tabs reactivo y limpiar

**Objective:** Envolver `tabs` en `ref` y eliminar CSS muerto del bottom nav.

**Files:**
- Modify: `src/components/layout/NavFooter.vue`
- Modify: `src/styles/tailwind.css`

**Step 1: Wrap tabs in ref**

Change:
```ts
const tabs = [
```
to:
```ts
const tabs = ref([
```

Change `tabs.filter` in template to `tabs.value.filter` or use `computed` for filtered tabs.

**Step 2: Build verify**

```
export PATH="/usr/lib/node_modules/corepack/shims:$PATH" && pnpm run build
```

---

### Task 7: Sincronizar versión en drawer

**Objective:** El drawer muestra `v{{ settingsStore.uiVersion }}` mientras el dropdown muestra `V: ${settingsStore.uiVersion}` — unificar formato.

**Files:**
- Modify: `src/components/layout/NavBar.vue`

**Step 1:** Change the drawer version display from:
```html
<span>v{{ settingsStore.uiVersion }}</span>
```
to:
```html
<span>{{ `V: ${settingsStore.uiVersion}` }}</span>
```

---

### Task 8: Build y deploy final

**Objective:** Verificar que todo compile y desplegar.

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
- [ ] Desktop nav links have correct hover/active styles
- [ ] Active nav link shows accent underline indicator
- [ ] Mobile bottom nav shows active indicator bar
- [ ] Bot status dot shows Online (green) / Offline (red)
- [ ] Account button has correct border/background
- [ ] Drawer closes on navigation
- [ ] Drawer shows version format `V: x.x.x`
- [ ] No `border-panel` class warnings in console
- [ ] No `.router-link-active` stale styles
- [ ] No duplicate CSS rules for `.ft-nav-link`

---

## Risks and open questions

- **Riesgo bajo**: Los cambios son solo CSS + template. No hay lógica de negocio.
- **`text-muted` class**: Puede que ya esté definida en PrimeVue o Tailwind. Verificar con `grep -n "\.text-muted" src/styles/tailwind.css` antes de agregarla.
- **`ft-navbar-account-btn`**: Asegurarse que el template usa esta clase y no la antigua `ft-navbar-account-button`.
