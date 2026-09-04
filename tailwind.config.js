/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        night: {
          950: 'var(--night-950)',
          900: 'var(--night-900)',
          850: 'var(--night-850)',
          800: 'var(--night-800)',
          700: 'var(--night-700)',
        },
        moon: {
          DEFAULT: 'var(--moon)',
          muted: 'var(--moon-muted)',
          dim: 'var(--moon-dim)',
          faint: 'var(--moon-faint)',
        },
        frost: 'var(--frost)',
        lunar: { blue: 'var(--lunar-blue)', violet: 'var(--lunar-violet)' },
        radiance: 'var(--radiance)',
        star: 'var(--star-gold)',
        danger: 'var(--danger)',
        success: 'var(--success)',
      },
      fontFamily: {
        display: ['Marcellus', 'Cormorant Garamond', 'Iowan Old Style', 'Georgia', 'serif'],
        sans: ['Inter var', 'Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        num: ['Inter var', 'Inter', 'system-ui', 'sans-serif'],
      },
      letterSpacing: { widest: '0.22em', wide2: '0.14em' },
      borderRadius: { sheet: '28px' },
      boxShadow: {
        halo: '0 0 60px -18px rgba(169, 213, 232, 0.55)',
        lift: '0 18px 50px -28px rgba(0,0,0,0.9)',
      },
      transitionTimingFunction: { lunar: 'cubic-bezier(0.22, 0.8, 0.28, 1)' },
    },
  },
  plugins: [],
}
