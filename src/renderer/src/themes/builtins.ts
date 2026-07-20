import type { ThemeDef } from '@shared/types'

/**
 * Встроенные темы — отгружаются с приложением, id зарезервированы (нельзя
 * создать/импортировать пользовательскую тему с тем же id, см. treeStore.ts).
 * AMOLED/Watch Dogs и Светлая — это ровно те значения, что раньше жили
 * статично в styles.css (:root / :root[data-theme='light']); теперь темы
 * применяются через inline CSS custom properties (см. themes/apply.ts), а не
 * через переключение data-атрибута между двумя зашитыми наборами.
 */
export const BUILTIN_THEMES: ThemeDef[] = [
  {
    id: 'amoled',
    name: 'AMOLED / Watch Dogs',
    dark: true,
    builtin: true,
    vars: {
      bg: '#000000',
      'bg-panel': '#000000',
      'bg-graph': '#000000',
      surface: '#0b0b0d',
      'surface-2': '#141416',
      hover: 'rgba(255, 255, 255, 0.055)',
      border: 'rgba(255, 255, 255, 0.09)',
      'border-strong': 'rgba(255, 255, 255, 0.16)',
      text: '#eceef2',
      'text-dim': '#8b8f98',
      'text-faint': '#5a5e66',
      accent: '#8b5cf6',
      'accent-soft': 'rgba(139, 92, 246, 0.18)',
      danger: '#f4676b',
      shadow: '0 6px 20px rgba(0, 0, 0, 0.6)'
    },
    branchColors: ['#8b5cf6', '#22a7f0', '#ef4444', '#b5d40f', '#f59e0b', '#10b981', '#ec4899', '#06b6d4']
  },
  {
    id: 'light',
    name: 'Светлая',
    dark: false,
    builtin: true,
    vars: {
      bg: '#f4f6fa',
      'bg-panel': '#fbfcfe',
      'bg-graph': '#eef1f6',
      surface: '#ffffff',
      'surface-2': '#f5f7fb',
      hover: 'rgba(0, 0, 0, 0.035)',
      border: 'rgba(15, 25, 45, 0.08)',
      'border-strong': 'rgba(15, 25, 45, 0.16)',
      text: '#16202e',
      'text-dim': '#5b6675',
      'text-faint': '#9aa4b2',
      accent: '#7c4fe0',
      'accent-soft': 'rgba(124, 79, 224, 0.12)',
      danger: '#d8453f',
      shadow: '0 4px 16px rgba(20, 30, 50, 0.08)'
    },
    branchColors: ['#7c4fe0', '#1f8fd4', '#d8453f', '#8bab13', '#c2760a', '#0d9467', '#d1447c', '#0891a8']
  },
  {
    id: 'synthwave',
    name: 'Синтвейв',
    dark: true,
    builtin: true,
    vars: {
      bg: '#0a0212',
      'bg-panel': '#0a0212',
      'bg-graph': '#0a0212',
      surface: '#140a1f',
      'surface-2': '#1d1030',
      hover: 'rgba(255, 255, 255, 0.05)',
      border: 'rgba(255, 255, 255, 0.09)',
      'border-strong': 'rgba(255, 255, 255, 0.18)',
      text: '#f3e8ff',
      'text-dim': '#b39ddb',
      'text-faint': '#6b5a7a',
      accent: '#ec4899',
      'accent-soft': 'rgba(236, 72, 153, 0.18)',
      danger: '#ff5f6d',
      shadow: '0 6px 20px rgba(0, 0, 0, 0.6)'
    },
    branchColors: ['#ec4899', '#06b6d4', '#f59e0b', '#8b5cf6', '#22d3ee', '#f43f5e', '#a78bfa', '#fb7185']
  },
  {
    id: 'nuxt',
    name: 'Nuxt UI',
    dark: true,
    builtin: true,
    vars: {
      bg: '#020617',
      'bg-panel': '#020617',
      'bg-graph': '#020617',
      surface: '#0f172a',
      'surface-2': '#1e293b',
      hover: 'rgba(255, 255, 255, 0.05)',
      border: 'rgba(255, 255, 255, 0.08)',
      'border-strong': 'rgba(255, 255, 255, 0.14)',
      text: '#f1f5f9',
      'text-dim': '#94a3b8',
      'text-faint': '#64748b',
      accent: '#00dc82',
      'accent-soft': 'rgba(0, 220, 130, 0.16)',
      danger: '#fb7185',
      shadow: '0 6px 20px rgba(0, 0, 0, 0.55)'
    },
    branchColors: ['#00dc82', '#38bdf8', '#fb7185', '#fbbf24', '#a78bfa', '#2dd4bf', '#f472b6', '#818cf8']
  }
]

export const DEFAULT_THEME_ID = 'amoled'
