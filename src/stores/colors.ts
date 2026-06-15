const STORE_UI_COLORS = 'ftUIColorSettings';

export enum ColorPreferences {
  GREEN_UP = 'greenUp',
  RED_UP = 'redUp',
}

export const primaryAccentOptions = [
  {
    value: 'amber',
    text: 'Amber',
    p50: '#fffbeb',
    p100: '#fef3c7',
    p200: '#fde68a',
    p300: '#fcd34d',
    p400: '#fbbf24',
    p500: '#f59e0b',
    p600: '#d97706',
    p700: '#b45309',
    p800: '#92400e',
    p900: '#78350f',
    p950: '#451a03',
    light: '#a16207',
    lightHover: '#92400e',
    lightActive: '#78350f',
    lightRgb: '161 98 7',
    dark: '#facc15',
    darkHover: '#fde047',
    darkActive: '#f59e0b',
    darkRgb: '250 204 21',
  },
  {
    value: 'blue',
    text: 'Blue',
    p50: '#eff6ff',
    p100: '#dbeafe',
    p200: '#bfdbfe',
    p300: '#93c5fd',
    p400: '#60a5fa',
    p500: '#3b82f6',
    p600: '#2563eb',
    p700: '#1d4ed8',
    p800: '#1e40af',
    p900: '#1e3a8a',
    p950: '#172554',
    light: '#2563eb',
    lightHover: '#1d4ed8',
    lightActive: '#1e40af',
    lightRgb: '37 99 235',
    dark: '#60a5fa',
    darkHover: '#93c5fd',
    darkActive: '#3b82f6',
    darkRgb: '96 165 250',
  },
  {
    value: 'emerald',
    text: 'Emerald',
    p50: '#ecfdf5',
    p100: '#d1fae5',
    p200: '#a7f3d0',
    p300: '#6ee7b7',
    p400: '#34d399',
    p500: '#10b981',
    p600: '#059669',
    p700: '#047857',
    p800: '#065f46',
    p900: '#064e3b',
    p950: '#022c22',
    light: '#047857',
    lightHover: '#065f46',
    lightActive: '#064e3b',
    lightRgb: '4 120 87',
    dark: '#34d399',
    darkHover: '#6ee7b7',
    darkActive: '#10b981',
    darkRgb: '52 211 153',
  },
  {
    value: 'violet',
    text: 'Violet',
    p50: '#f5f3ff',
    p100: '#ede9fe',
    p200: '#ddd6fe',
    p300: '#c4b5fd',
    p400: '#a78bfa',
    p500: '#8b5cf6',
    p600: '#7c3aed',
    p700: '#6d28d9',
    p800: '#5b21b6',
    p900: '#4c1d95',
    p950: '#1e1b4b',
    light: '#7c3aed',
    lightHover: '#6d28d9',
    lightActive: '#5b21b6',
    lightRgb: '124 58 237',
    dark: '#a78bfa',
    darkHover: '#c4b5fd',
    darkActive: '#8b5cf6',
    darkRgb: '167 139 250',
  },
  {
    value: 'rose',
    text: 'Rose',
    p50: '#fff1f2',
    p100: '#ffe4e6',
    p200: '#fecdd3',
    p300: '#fda4af',
    p400: '#fb7185',
    p500: '#f43f5e',
    p600: '#e11d48',
    p700: '#be123c',
    p800: '#9f1239',
    p900: '#881337',
    p950: '#4c0519',
    light: '#e11d48',
    lightHover: '#be123c',
    lightActive: '#9f1239',
    lightRgb: '225 29 72',
    dark: '#fb7185',
    darkHover: '#fda4af',
    darkActive: '#f43f5e',
    darkRgb: '251 113 133',
  },
  {
    value: 'cyan',
    text: 'Cyan',
    p50: '#ecfeff',
    p100: '#cffafe',
    p200: '#a5f3fc',
    p300: '#67e8f9',
    p400: '#22d3ee',
    p500: '#06b6d4',
    p600: '#0891b2',
    p700: '#0e7490',
    p800: '#155e75',
    p900: '#164e63',
    p950: '#083344',
    light: '#0891b2',
    lightHover: '#0e7490',
    lightActive: '#155e75',
    lightRgb: '8 145 178',
    dark: '#22d3ee',
    darkHover: '#67e8f9',
    darkActive: '#06b6d4',
    darkRgb: '34 211 238',
  },
] as const;

export type PrimaryAccent = (typeof primaryAccentOptions)[number]['value'];

export const useColorStore = defineStore('colorStore', {
  // other options...
  state: () => {
    return {
      colorPreference: ColorPreferences.GREEN_UP,
      primaryAccent: 'amber' as PrimaryAccent,
      colorUp: '#26A69A',
      colorDown: '#EF5350',
      colorProfit: '#12bb7b',
      colorLoss: '#ef5350',
    };
  },
  getters: {
    primaryAccentConfig(state) {
      return (
        primaryAccentOptions.find((option) => option.value === state.primaryAccent) ??
        primaryAccentOptions[0]
      );
    },
    cssVars(state) {
      const accent =
        primaryAccentOptions.find((option) => option.value === state.primaryAccent) ??
        primaryAccentOptions[0];
      return {
        '--color-profit': state.colorProfit,
        '--color-loss': state.colorLoss,
        '--p-primary-50': accent.p50,
        '--p-primary-100': accent.p100,
        '--p-primary-200': accent.p200,
        '--p-primary-300': accent.p300,
        '--p-primary-400': accent.p400,
        '--p-primary-500': accent.p500,
        '--p-primary-600': accent.p600,
        '--p-primary-700': accent.p700,
        '--p-primary-800': accent.p800,
        '--p-primary-900': accent.p900,
        '--p-primary-950': accent.p950,
        '--ft-accent-light': accent.light,
        '--ft-accent-light-hover': accent.lightHover,
        '--ft-accent-light-active': accent.lightActive,
        '--ft-accent-light-rgb': accent.lightRgb,
        '--ft-accent-dark': accent.dark,
        '--ft-accent-dark-hover': accent.darkHover,
        '--ft-accent-dark-active': accent.darkActive,
        '--ft-accent-dark-rgb': accent.darkRgb,
      };
    },
  },
  actions: {
    updateProfitLossColor() {
      const [colorUp, colorDown] =
        this.colorPreference === ColorPreferences.GREEN_UP
          ? ['#26A69A', '#ef5350']
          : ['#ef5350', '#26A69A'];
      this.colorUp = colorUp;
      this.colorDown = colorDown;
    },
  },
  persist: {
    key: STORE_UI_COLORS,
    pick: ['colorPreference', 'primaryAccent'],
  },
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useColorStore, import.meta.hot));
}
