import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--color-bg)',
        surface: 'var(--color-surface)',
        'surface-raised': 'var(--color-surface-raised)',
        ink: 'var(--color-ink)',
        'ink-muted': 'var(--color-ink-muted)',
        border: 'var(--color-border)',
        accent: 'var(--color-accent)',
        'accent-ink': 'var(--color-accent-ink)',
        danger: 'var(--color-danger)',
        success: 'var(--color-success)',
        sale: 'var(--color-sale)',
        glass: 'var(--glass-bg)',
        'glass-strong': 'var(--glass-bg-strong)',
        'glass-border': 'var(--glass-border)',
      },
      fontFamily: { sans: ['var(--font-sans)'] },
      borderRadius: { sm: 'var(--radius-sm)', md: 'var(--radius-md)', lg: 'var(--radius-lg)', xl: 'var(--radius-xl)' },
      boxShadow: { sm: 'var(--shadow-sm)', md: 'var(--shadow-md)', lg: 'var(--shadow-lg)' },
      backdropBlur: { glass: 'var(--glass-blur)' },
      transitionDuration: { snap: '150ms', base: '300ms' },
      transitionTimingFunction: { standard: 'var(--ease-standard)' },
    },
  },
  plugins: [],
} satisfies Config;
