export const colors = {
  background: {
    canvas: '#071019',
    surface: '#0b1822',
    elevated: '#0f202c',
  },
  border: {
    default: '#203542',
    strong: '#35505f',
  },
  text: {
    primary: '#f4f7fa',
    secondary: '#a8b8c4',
    muted: '#718594',
  },
  brand: {
    primary: '#e1282e',
    primaryHover: '#f23a40',
    primaryPressed: '#b51e25',
  },
  semantic: {
    success: '#6fd31c',
    warning: '#f5a500',
    danger: '#ef3038',
    info: '#21a9ef',
  },
} as const;

export const spacing = {
  0: '0',
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '24px',
  6: '32px',
  7: '48px',
  8: '64px',
} as const;

export const radius = {
  control: '4px',
  card: '6px',
  dialog: '10px',
  pill: '999px',
} as const;

export const motion = {
  fast: '120ms',
  normal: '150ms',
  slow: '220ms',
  easing: 'ease-out',
} as const;

export const typography = {
  family: "'Inter', 'Segoe UI', system-ui, sans-serif",
  size: {
    caption: '11px',
    body: '13px',
    title3: '16px',
    title2: '20px',
    title1: '26px',
  },
} as const;
