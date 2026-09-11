import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--color-bg)',
        surface: 'var(--color-surface)',
        ink: 'var(--color-ink)',
        'ink-muted': 'var(--color-ink-muted)',
        border: 'var(--color-border)',
        accent: 'var(--color-accent)',
        danger: 'var(--color-danger)',
        success: 'var(--color-success)',
      },
      fontFamily: { sans: ['var(--font-sans)'] },
      borderRadius: { sm: 'var(--radius-sm)', md: 'var(--radius-md)', lg: 'var(--radius-lg)' },
      boxShadow: { sm: 'var(--shadow-sm)', md: 'var(--shadow-md)' },
      transitionDuration: { snap: '150ms', base: '300ms' },
      transitionTimingFunction: { standard: 'var(--ease-standard)' },
    },
  },
  plugins: [],
} satisfies Config;
