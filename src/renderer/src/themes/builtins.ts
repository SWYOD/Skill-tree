import type { ThemeDef } from '@shared/types'

/**
 * Встроенные темы — отгружаются с приложением, id зарезервированы (нельзя
 * создать/импортировать пользовательскую тему с тем же id, см. treeStore.ts).
 * Темы применяются через inline CSS custom properties на :root (см.
 * themes/apply.ts). Каждая тема несёт свой основной вид (vars/dark) и
 * опциональный altVariant — обратный по яркости вид той же темы (тумблер
 * тёмный/светлый в SettingsPanel.tsx, а не отдельная тема в галерее).
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
      'accent-text': '#0a0410',
      danger: '#f4676b',
      shadow: '0 6px 20px rgba(0, 0, 0, 0.6)'
    },
    branchColors: ['#8b5cf6', '#22a7f0', '#ef4444', '#b5d40f', '#f59e0b', '#10b981', '#ec4899', '#06b6d4'],
    // Раньше «Светлая» жила отдельной темой в галерее — по факту это ровно
    // светлый вид AMOLED/Watch Dogs (та же палитра, тот же макет карточек),
    // поэтому теперь это altVariant одной темы с быстрым тумблером
    // тёмный/светлый (см. ThemesPopup.tsx), а не отдельный выбор из галереи.
    altVariant: {
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
        'accent-text': '#ffffff',
        danger: '#d8453f',
        shadow: '0 4px 16px rgba(20, 30, 50, 0.08)'
      },
      branchColors: ['#7c4fe0', '#1f8fd4', '#d8453f', '#8bab13', '#c2760a', '#0d9467', '#d1447c', '#0891a8']
    }
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
      'accent-text': '#0a0410',
      danger: '#ff5f6d',
      shadow: '0 6px 20px rgba(0, 0, 0, 0.6)'
    },
    branchColors: ['#ec4899', '#06b6d4', '#f59e0b', '#8b5cf6', '#22d3ee', '#f43f5e', '#a78bfa', '#fb7185'],
    altVariant: {
      vars: {
        bg: '#fdf4fb',
        'bg-panel': '#fdf7fc',
        'bg-graph': '#faeaf7',
        surface: '#ffffff',
        'surface-2': '#f7e8f5',
        hover: 'rgba(219, 39, 119, 0.06)',
        border: 'rgba(157, 23, 77, 0.12)',
        'border-strong': 'rgba(157, 23, 77, 0.22)',
        text: '#3b0764',
        'text-dim': '#86198f',
        'text-faint': '#c186d1',
        accent: '#c026d3',
        'accent-soft': 'rgba(192, 38, 211, 0.14)',
        'accent-text': '#ffffff',
        danger: '#e11d48',
        shadow: '0 4px 16px rgba(157, 23, 77, 0.1)'
      },
      branchColors: ['#c026d3', '#0891b2', '#d97706', '#7c3aed', '#0e7490', '#e11d48', '#9333ea', '#db2777']
    }
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
      'accent-text': '#0a0410',
      danger: '#fb7185',
      shadow: '0 6px 20px rgba(0, 0, 0, 0.55)'
    },
    branchColors: ['#00dc82', '#38bdf8', '#fb7185', '#fbbf24', '#a78bfa', '#2dd4bf', '#f472b6', '#818cf8'],
    altVariant: {
      vars: {
        bg: '#f0fdf6',
        'bg-panel': '#f7fefb',
        'bg-graph': '#e9fbf1',
        surface: '#ffffff',
        'surface-2': '#e6f9ee',
        hover: 'rgba(0, 168, 107, 0.06)',
        border: 'rgba(4, 120, 87, 0.12)',
        'border-strong': 'rgba(4, 120, 87, 0.22)',
        text: '#052e1c',
        'text-dim': '#3f7259',
        'text-faint': '#82ab97',
        accent: '#059669',
        'accent-soft': 'rgba(5, 150, 105, 0.14)',
        'accent-text': '#0a0410',
        danger: '#dc2626',
        shadow: '0 4px 16px rgba(4, 120, 87, 0.08)'
      },
      branchColors: ['#059669', '#0284c7', '#e11d48', '#d97706', '#7c3aed', '#0d9488', '#db2777', '#4f46e5']
    }
  },
  {
    id: 'linear',
    name: 'Linear',
    dark: true,
    builtin: true,
    vars: {
      bg: '#08090a',
      'bg-panel': '#08090a',
      'bg-graph': '#0a0b0c',
      surface: '#141516',
      'surface-2': '#1c1d1f',
      hover: 'rgba(255, 255, 255, 0.05)',
      border: 'rgba(255, 255, 255, 0.06)',
      'border-strong': 'rgba(255, 255, 255, 0.13)',
      text: '#f7f8f8',
      'text-dim': '#8a8f98',
      'text-faint': '#62666d',
      accent: '#5e6ad2',
      'accent-soft': 'rgba(94, 106, 210, 0.18)',
      'accent-text': '#0a0410',
      danger: '#eb5757',
      shadow: '0 6px 24px rgba(0, 0, 0, 0.55)'
    },
    branchColors: ['#5e6ad2', '#4ea7fc', '#4cb782', '#f2c94c', '#f2994a', '#eb5757', '#dc6bdb', '#95a2b3'],
    altVariant: {
      vars: {
        bg: '#fbfbfb',
        'bg-panel': '#ffffff',
        'bg-graph': '#f6f6f7',
        surface: '#ffffff',
        'surface-2': '#f2f2f3',
        hover: 'rgba(0, 0, 0, 0.04)',
        border: 'rgba(0, 0, 0, 0.08)',
        'border-strong': 'rgba(0, 0, 0, 0.14)',
        text: '#1a1a1c',
        'text-dim': '#63666d',
        'text-faint': '#9a9ca3',
        accent: '#5e6ad2',
        'accent-soft': 'rgba(94, 106, 210, 0.12)',
        'accent-text': '#ffffff',
        danger: '#eb5757',
        shadow: '0 4px 16px rgba(20, 20, 25, 0.08)'
      },
      branchColors: ['#5e6ad2', '#2b7fd6', '#2f9e5f', '#c9960a', '#d1670a', '#d13f3f', '#a544c9', '#5a6b7a']
    }
  },
  {
    id: 'github-dark',
    name: 'GitHub Dark',
    dark: true,
    builtin: true,
    vars: {
      bg: '#0d1117',
      'bg-panel': '#010409',
      'bg-graph': '#0d1117',
      surface: '#161b22',
      'surface-2': '#21262d',
      hover: 'rgba(177, 186, 196, 0.08)',
      border: 'rgba(240, 246, 252, 0.1)',
      'border-strong': 'rgba(240, 246, 252, 0.18)',
      text: '#e6edf3',
      'text-dim': '#7d8590',
      'text-faint': '#6e7681',
      accent: '#2f81f7',
      'accent-soft': 'rgba(47, 129, 247, 0.18)',
      'accent-text': '#0a0410',
      danger: '#f85149',
      shadow: '0 6px 20px rgba(1, 4, 9, 0.6)'
    },
    branchColors: ['#2f81f7', '#3fb950', '#f85149', '#d29922', '#a371f7', '#db61a2', '#1f6feb', '#56d364'],
    altVariant: {
      vars: {
        bg: '#ffffff',
        'bg-panel': '#f6f8fa',
        'bg-graph': '#ffffff',
        surface: '#ffffff',
        'surface-2': '#f6f8fa',
        hover: 'rgba(208, 215, 222, 0.32)',
        border: 'rgba(31, 35, 40, 0.1)',
        'border-strong': 'rgba(31, 35, 40, 0.18)',
        text: '#1f2328',
        'text-dim': '#59636e',
        'text-faint': '#8b949e',
        accent: '#0969da',
        'accent-soft': 'rgba(9, 105, 218, 0.12)',
        'accent-text': '#ffffff',
        danger: '#d1242f',
        shadow: '0 4px 16px rgba(31, 35, 40, 0.08)'
      },
      branchColors: ['#0969da', '#1a7f37', '#d1242f', '#9a6700', '#8250df', '#bf3989', '#0550ae', '#2da44e']
    }
  },
  {
    id: 'dracula',
    name: 'Dracula',
    dark: true,
    builtin: true,
    vars: {
      bg: '#282a36',
      'bg-panel': '#282a36',
      'bg-graph': '#21222c',
      surface: '#343746',
      'surface-2': '#44475a',
      hover: 'rgba(255, 255, 255, 0.06)',
      border: 'rgba(255, 255, 255, 0.08)',
      'border-strong': 'rgba(255, 255, 255, 0.16)',
      text: '#f8f8f2',
      'text-dim': '#a9abb8',
      'text-faint': '#6272a4',
      accent: '#bd93f9',
      'accent-soft': 'rgba(189, 147, 249, 0.18)',
      'accent-text': '#0a0410',
      danger: '#ff5555',
      shadow: '0 6px 20px rgba(0, 0, 0, 0.55)'
    },
    branchColors: ['#bd93f9', '#ff79c6', '#8be9fd', '#50fa7b', '#ffb86c', '#f1fa8c', '#ff5555', '#6272a4'],
    altVariant: {
      vars: {
        bg: '#f8f8f2',
        'bg-panel': '#ffffff',
        'bg-graph': '#f1f1ec',
        surface: '#ffffff',
        'surface-2': '#eeeef5',
        hover: 'rgba(98, 114, 164, 0.08)',
        border: 'rgba(40, 42, 54, 0.1)',
        'border-strong': 'rgba(40, 42, 54, 0.18)',
        text: '#282a36',
        'text-dim': '#4d4f6b',
        'text-faint': '#8890b5',
        accent: '#8c4fe0',
        'accent-soft': 'rgba(140, 79, 224, 0.14)',
        'accent-text': '#ffffff',
        danger: '#e5484d',
        shadow: '0 4px 16px rgba(40, 42, 54, 0.08)'
      },
      branchColors: ['#8c4fe0', '#d6408f', '#0f8fa8', '#1fa855', '#c9781f', '#a89c0e', '#e5484d', '#6272a4']
    }
  },
  {
    id: 'discord',
    name: 'Discord',
    dark: true,
    builtin: true,
    vars: {
      bg: '#313338',
      'bg-panel': '#2b2d31',
      'bg-graph': '#1e1f22',
      surface: '#2b2d31',
      'surface-2': '#1e1f22',
      hover: 'rgba(78, 80, 88, 0.35)',
      border: 'rgba(255, 255, 255, 0.06)',
      'border-strong': 'rgba(255, 255, 255, 0.13)',
      text: '#f2f3f5',
      'text-dim': '#b5bac1',
      'text-faint': '#6d6f78',
      accent: '#5865f2',
      'accent-soft': 'rgba(88, 101, 242, 0.2)',
      'accent-text': '#0a0410',
      danger: '#ed4245',
      shadow: '0 6px 20px rgba(0, 0, 0, 0.5)'
    },
    branchColors: ['#5865f2', '#57f287', '#fee75c', '#eb459e', '#ed4245', '#00a8fc', '#949cf7', '#3ba55d'],
    altVariant: {
      vars: {
        bg: '#ffffff',
        'bg-panel': '#f2f3f5',
        'bg-graph': '#ffffff',
        surface: '#f2f3f5',
        'surface-2': '#e3e5e8',
        hover: 'rgba(6, 6, 7, 0.04)',
        border: 'rgba(6, 6, 7, 0.08)',
        'border-strong': 'rgba(6, 6, 7, 0.16)',
        text: '#060607',
        'text-dim': '#5c5e66',
        'text-faint': '#949ba4',
        accent: '#5865f2',
        'accent-soft': 'rgba(88, 101, 242, 0.12)',
        'accent-text': '#ffffff',
        danger: '#da373c',
        shadow: '0 4px 16px rgba(6, 6, 7, 0.08)'
      },
      branchColors: ['#5865f2', '#248046', '#9c7c00', '#c03b8f', '#da373c', '#0074b8', '#4752c4', '#2d7d46']
    }
  },
  {
    id: 'claude-desktop',
    name: 'Claude Desktop',
    dark: true,
    builtin: true,
    vars: {
      bg: '#262624',
      'bg-panel': '#262624',
      'bg-graph': '#211f1d',
      surface: '#30302e',
      'surface-2': '#3a3936',
      hover: 'rgba(255, 255, 255, 0.06)',
      border: 'rgba(255, 255, 255, 0.08)',
      'border-strong': 'rgba(255, 255, 255, 0.15)',
      text: '#f2f0ed',
      'text-dim': '#a8a29a',
      'text-faint': '#6b665f',
      accent: '#c96442',
      'accent-soft': 'rgba(201, 100, 66, 0.18)',
      'accent-text': '#0a0410',
      danger: '#e5484d',
      shadow: '0 6px 20px rgba(0, 0, 0, 0.5)'
    },
    branchColors: ['#c96442', '#6a9bcc', '#8ba888', '#d4a24c', '#b0796a', '#7fb0a0', '#a695c9', '#9b9890'],
    altVariant: {
      vars: {
        bg: '#faf9f5',
        'bg-panel': '#ffffff',
        'bg-graph': '#f5f3ec',
        surface: '#ffffff',
        'surface-2': '#f0eee6',
        hover: 'rgba(30, 30, 28, 0.045)',
        border: 'rgba(30, 30, 28, 0.1)',
        'border-strong': 'rgba(30, 30, 28, 0.18)',
        text: '#3d3d3a',
        'text-dim': '#6b6862',
        'text-faint': '#a19d92',
        accent: '#c96442',
        'accent-soft': 'rgba(201, 100, 66, 0.14)',
        'accent-text': '#0a0410',
        danger: '#c33d3d',
        shadow: '0 4px 16px rgba(30, 30, 28, 0.08)'
      },
      branchColors: ['#c96442', '#3d76a8', '#5a7d56', '#a67f2e', '#8a5347', '#4d8a78', '#7d6a9e', '#726d64']
    }
  }
]

export const DEFAULT_THEME_ID = 'amoled'
