# FreqUI — Refactorización y Reutilización de Código

**Goal:** Identify patterns, duplication, and refactoring opportunities to make the codebase more maintainable.

---

## 🔴 Alta prioridad

### R1 — ECharts registrado en cada componente (duplicación masiva)

**Problema:** Cada uno de los 11 componentes ECharts registra sus propios módulos:

```ts
// En CADA componente:
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { LineChart, BarChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent, DataZoomComponent, ... } from 'echarts/components';
use([CanvasRenderer, LineChart, BarChart, GridComponent, ...]);
```

**Archivos afectados (11):**
- `CumProfitChart.vue`, `TimePeriodChart.vue`, `HourlyChart.vue`
- `TradesLogChart.vue`, `TradeDurationChart.vue`, `BalanceChart.vue`
- `MarketChangeChart.vue`, `ProfitDistributionChart.vue`, `WalletHistoryChart.vue`
- `AdvancedDashboardView.vue`
- `percentageTool.ts` (importa tipos)

**Refactor:**
Crear `src/utils/charts/echartsSetup.ts` con UNA sola importación y registro de todos los módulos ECharts necesarios:

```ts
// src/utils/charts/echartsSetup.ts
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { BarChart, LineChart, ScatterChart, GraphChart } from 'echarts/charts';
import {
  GridComponent, TooltipComponent, LegendComponent, DataZoomComponent,
  DatasetComponent, MarkLineComponent, MarkPointComponent,
} from 'echarts/components';

use([
  CanvasRenderer,
  BarChart, LineChart, ScatterChart, GraphChart,
  GridComponent, TooltipComponent, LegendComponent, DataZoomComponent,
  DatasetComponent, MarkLineComponent, MarkPointComponent,
]);
```

Luego cada componente solo importa `echartsSetup` y `vue-echarts`:

```ts
import ECharts from 'vue-echarts';
import '@/utils/charts/echartsSetup';
```

**Impacto:** Elimina ~15 líneas duplicadas × 11 archivos = **~165 líneas menos**, registro único de ECharts.

---

### R2 — `ftbot.ts` está sobredimensionado (1.296 líneas)

**Problema:** El store `ftbot.ts` mezcla:
- Conexiones WebSocket
- Gestión de trades (open/closed)
- Gestión de velas (candles)
- Backtesting
- Balance
- Pairs/Locks
- Métricas de rendimiento
- Estado del bot

**Refactor:** Dividir en stores más pequeños:

| Store nuevo | Responsabilidad | Líneas actuales |
|---|---|---|
| `tradesStore.ts` | Open/closed trades, CRUD | ~300 |
| `candleStore.ts` | OHLCV data, timeframes | ~200 |
| `backtestStore.ts` | Backtest state | ~200 |
| `botStore.ts` (reducido) | Conexión, estado, auth | ~350 |

**Impacto:** Código más mantenible, cada store con responsabilidad única. **Riesgo medio** — requiere actualizar todos los imports.

---

### R3 — `tailwind.css` tiene 3.031 líneas de CSS a medida

**Problema:** En vez de usar utilidades Tailwind, el proyecto tiene CSS costumizado extenso (~3.000 líneas). Esto duplica lo que Tailwind ya provee y es difícil de mantener patrones consistentes.

**Archivo:** `src/styles/tailwind.css`

**Refactor:** 
1. Extraer a módulos CSS separados por feature:
   - `styles/components/trade.css` (todo lo `ft-trade-*`)
   - `styles/components/dashboard.css` (todo lo `ft-dashboard-*`)
   - `styles/components/analytics.css` (todo lo `ft-advanced-*`)
   - `styles/components/history.css` (todo lo `ft-history-*`)
2. Reemplazar clases CSS custom con utilidades Tailwind donde sea posible

**Impacto:** Código CSS organizado por feature. **Riesgo bajo** — solo movimiento de archivos.

---

## 🟡 Prioridad media

### R4 — Patrón DataTable + Mobile List duplicado 3 veces

**Problema:** El patrón "mostrar DataTable en desktop y lista en mobile" se repite en 3 lugares con la misma estructura:

```html
<DataTable class="ft-advanced-desktop-table" ... />
<div class="ft-advanced-mobile-list">
  <div v-for="... " class="ft-mobile-row-card"> ... </div>
</div>
```

**Archivos:**
- `AdvancedDashboardView.vue` (3 veces: pair, enter tag, exit reason)
- `MobileTradesListView.vue` (1 vez: trade history)
- `TradeList.vue` (usa `ft-trade-mobile-list`)

**Refactor:** Crear un componente genérico `ResponsiveTable.vue`:

```html
<ResponsiveTable
  :columns="columns"
  :rows="data"
  :mobile-card-component="MobileCard"
>
  <template #cell-profit="{ row }"> ... </template>
</ResponsiveTable>
```

**Impacto:** DRY, cambios de layout en un solo lugar. **Riesgo medio** — requiere diseño de API de componentes.

---

### R5 — `PeriodBreakdown` tiene dos templates separados (individual/multi-bot)

**Archivo:** `src/components/ftbot/PeriodBreakdown.vue`

**Problema:** La lógica de `selectedStats` tiene un `if/else` completo para single-bot vs multi-bot, y el template tiene `v-if="!props.multiBotView"` repartido.

**Refactor:** Extraer la lógica single-bot a un subcomponente `PeriodBreakdownSingle.vue` y multi-bot a `PeriodBreakdownMulti.vue`. El componente padre solo decide cuál renderizar.

---

### R6 — Composable `api.ts` repite patrón try/catch

**Archivo:** `src/stores/ftbot.ts` (múltiples métodos)

**Problema:** Cada método en ftbot.ts sigue el mismo patrón:

```ts
async getXxx() {
  try {
    const { data } = await api.get('/xxx');
    this.xxx = data;
    return Promise.resolve(data);
  } catch (error) {
    console.error(error);
    return Promise.reject(error);
  }
}
```

**Refactor:** Crear un wrapper genérico:

```ts
async function apiCall<T>(path: string, setter: (data: T) => void): Promise<T> {
  try {
    const { data } = await api.get(path);
    setter(data);
    return data;
  } catch (error) {
    console.error(`API call failed: ${path}`, error);
    throw error;
  }
}
```

**Impacto:** Elimina ~5 líneas × 20 métodos = **~100 líneas**, código más legible.

---

### R7 — `tradingview` `CandleChartContainer` y `SingleCandleChartContainer` muy acoplados

**Archivo:** `src/components/charts/CandleChartContainer.vue` (274 líneas)
`SingleCandleChartContainer.vue` (154 líneas)

**Problema:** Los containers tienen lógica de selección de par, timeframe, plot config, y renderizado. El `SingleCandleChartContainer` está dentro de `CandleChartContainer`.

**Refactor:** Separar en:
- `ChartPairSelector.vue` — selección de par/timeframe
- `ChartPlotControls.vue` — configuración de plots
- `ChartRenderer.vue` — solo renderizado del chart

---

## 🟢 Baja prioridad

### R8 — `numberformat.ts` y `timeformat.ts` tienen funciones que podrían unificarse

**Archivo:** `src/utils/formatters/numberformat.ts` (81 líneas)

Las funciones `formatPrice`, `formatPercent`, `formatPriceCurrency` están bien factorizadas. Sin cambios.

### R9 — `console.log` de debug remanentes

Buscar y eliminar `console.log` que no sean errores. Ya se limpiaron varios, pero hacer una pasada final:

```bash
grep -rn "console.log\|console.debug" src/ --include="*.ts" --include="*.vue" | grep -v ".d.ts" | grep -v "auto-imports" | grep -v "console.error"
```

---

## Resumen de ahorro estimado

| Refactor | Archivos afectados | Líneas eliminadas | Riesgo |
|---|---|---|---|
| R1 — ECharts setup único | 11 | ~165 | 🟢 Bajo |
| R2 — Store splitting | 30+ imports | ~400 reubicadas | 🟡 Medio |
| R3 — CSS modular | 1 | ~2.000 reubicadas | 🟢 Bajo |
| R4 — ResponsiveTable | 4 | ~100 | 🟡 Medio |
| R5 — PeriodBreakdown split | 2 | ~30 | 🟢 Bajo |
| R6 — API wrapper | 2 | ~100 | 🟡 Medio |
| R7 — Chart refactor | 2 | ~100 | 🟡 Medio |
| R9 — Console.log cleanup | varios | ~10 | 🟢 Bajo |

---

## Tareas recomendadas

### Task 1 (inmediata): ECharts setup unificado
- Crear `src/utils/charts/echartsSetup.ts`
- Actualizar los 11 archivos que importan ECharts
- Verificar build

### Task 2 (inmediata): Console.log cleanup
- Pasar grep y limpiar logs de debug
- Dejar solo `console.error` y logs intencionales

### Task 3 (corto plazo): CSS modular
- Dividir `tailwind.css` en módulos por feature
- Importar los módulos desde `main.ts`

### Task 4 (mediano plazo): Store splitting
- Requiere planificación más detallada
- Tests para asegurar que no se rompe nada

### Task 5 (opcional): ResponsiveTable component
- Diseñar API del componente
- Migrar las 3 instancias existentes
