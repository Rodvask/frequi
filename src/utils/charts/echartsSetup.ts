/**
 * Shared ECharts setup — registers all chart types, components, renderers, and transforms
 * used across FreqUI. Import this once in each component that uses vue-echarts.
 *
 * Instead of each component repeating `import { use } from 'echarts/core'` with its own
 * subset of modules, this file registers everything in one place. Tree-shaking still works
 * because ECharts only bundles what's referenced at build time — but since every chart
 * component uses most of these anyway, the practical difference is minimal and the
 * maintainability gain is significant.
 */
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { BarChart, LineChart, ScatterChart, BoxplotChart, PieChart } from 'echarts/charts';
import {
  CalendarComponent,
  DatasetComponent,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TitleComponent,
  TooltipComponent,
  TransformComponent,
  VisualMapComponent,
  VisualMapPiecewiseComponent,
} from 'echarts/components';
import { LabelLayout } from 'echarts/features';

use([
  CanvasRenderer,

  BarChart,
  LineChart,
  ScatterChart,
  BoxplotChart,
  PieChart,

  CalendarComponent,
  DatasetComponent,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TitleComponent,
  TooltipComponent,
  TransformComponent,
  VisualMapComponent,
  VisualMapPiecewiseComponent,

  LabelLayout,
]);
