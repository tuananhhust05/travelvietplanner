import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'hsl(var(--bg))',
        border: 'hsl(var(--border))',
        surface: {
          1: 'hsl(var(--s1))',
          2: 'hsl(var(--s2))',
          3: 'hsl(var(--s3))',
        },
        text: {
          DEFAULT: 'hsl(var(--text))',
          muted: 'hsl(var(--text-muted))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          fg: 'hsl(var(--primary-fg))',
        },
        ring: 'hsl(var(--ring))',
        secondary: '#f472b6',
        accent: '#eab308',
        success: '#22c55e',
        warning: '#f59e0b',
        danger: '#ef4444',
        info: '#3b82f6',
      },
      fontFamily: {
        sans: ['var(--font-be-vietnam)', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'monospace'],
        display: ['var(--font-playfair)', 'Georgia', 'serif'],
      },
      borderRadius: {
        sm: '6px',
        md: '10px',
        lg: '14px',
        xl: '20px',
        '2xl': '28px',
      },
      boxShadow: {
        e1: '0 1px 2px rgba(0,0,0,.4)',
        e2: '0 4px 12px rgba(0,0,0,.45)',
        e3: '0 12px 32px rgba(0,0,0,.5)',
        glow: '0 0 0 1px #10b98133, 0 8px 24px #10b98126',
      },
      transitionTimingFunction: {
        standard: 'cubic-bezier(.4,0,.2,1)',
        spring: 'cubic-bezier(.34,1.56,.64,1)',
      },
      transitionDuration: {
        fast: '120ms',
        base: '200ms',
        slow: '320ms',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pin-pulse': {
          '0%,100%': { opacity: '0.6', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.15)' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.6s linear infinite',
        'pin-pulse': 'pin-pulse 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
