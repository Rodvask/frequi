const STORE_UI_COLORS = 'ftUIColorSettings';

export enum ColorPreferences {
  GREEN_UP = 'greenUp',
  RED_UP = 'redUp',
}

export const primaryAccentOptions = [
  {
    value: 'amber',
    text: 'Amber',
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
