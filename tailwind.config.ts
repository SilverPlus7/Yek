import type { Config } from 'tailwindcss'

// These shades read CSS variables so the theme picker can swap palettes — see src/styles/themes.css.
const themed = (name: string, shades: number[]) =>
  Object.fromEntries(shades.map(s => [s, `rgb(var(--${name}-${s}) / <alpha-value>)`]))

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        slate: themed('slate', [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]),
        blue: themed('blue', [300, 400, 900]),
        red: themed('red', [300, 400, 900]),
        green: themed('green', [400, 500]),
        yellow: themed('yellow', [400, 500]),
      },
    },
  },
  plugins: [],
} satisfies Config
