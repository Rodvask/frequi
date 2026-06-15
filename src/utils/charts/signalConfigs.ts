export interface SignalColConfig {
  column: string;
  shape: 'arrowUp' | 'arrowDown';
  colorField?: 'colorUp' | 'colorDown' | 'amber';
  tagCol: 'enter_tag' | 'exit_tag';
  label: string;
}

export const SIGNAL_COLUMNS: SignalColConfig[] = [
  { column: '_buy_signal_close', shape: 'arrowUp', colorField: 'colorUp', tagCol: 'enter_tag', label: 'Long entry' },
  { column: '_enter_long_signal_close', shape: 'arrowUp', colorField: 'colorUp', tagCol: 'enter_tag', label: 'Long entry' },
  { column: '_sell_signal_close', shape: 'arrowDown', colorField: 'amber', tagCol: 'exit_tag', label: 'Long exit' },
  { column: '_exit_long_signal_close', shape: 'arrowDown', colorField: 'amber', tagCol: 'exit_tag', label: 'Long exit' },
  { column: '_enter_short_signal_close', shape: 'arrowDown', colorField: 'colorDown', tagCol: 'enter_tag', label: 'Short entry' },
  { column: '_exit_short_signal_close', shape: 'arrowUp', colorField: 'amber', tagCol: 'exit_tag', label: 'Short exit' },
];
