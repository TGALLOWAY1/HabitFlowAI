/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  // Class-based dark mode: the ThemeProvider toggles `class="dark"` / `class="light"`
  // on <html>. The pre-hydration script in index.html sets the correct class before
  // React boots so first paint matches the user's preference.
  darkMode: 'class',
  safelist: [
    // Category colors for data encoding (habit/goal categories).
    // These are NOT theme tokens — they remain visually distinct in both modes.
    {
      pattern: /text-(emerald|violet|rose|amber|blue|fuchsia|cyan|green)-500/,
      variants: ['hover', 'group-hover'],
    },
    {
      pattern: /bg-(emerald|violet|rose|amber|blue|fuchsia|cyan|green)-500/,
    }
  ],
  theme: {
    extend: {
      colors: {
        // Semantic theme tokens, driven by CSS variables defined in src/index.css
        // (and emitted at runtime from src/theme/palette.ts). The `rgb(var(--x) / <alpha-value>)`
        // pattern lets the existing opacity syntax (`bg-surface-1/80`) keep working.
        surface: {
          0: 'rgb(var(--surface-0) / <alpha-value>)',
          1: 'rgb(var(--surface-1) / <alpha-value>)',
          2: 'rgb(var(--surface-2) / <alpha-value>)',
        },
        content: {
          primary: 'rgb(var(--content-primary) / <alpha-value>)',
          secondary: 'rgb(var(--content-secondary) / <alpha-value>)',
          muted: 'rgb(var(--content-muted) / <alpha-value>)',
          'on-accent': 'rgb(var(--content-on-accent) / <alpha-value>)',
        },
        line: {
          subtle: 'rgb(var(--line-subtle) / <alpha-value>)',
          strong: 'rgb(var(--line-strong) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          strong: 'rgb(var(--accent-strong) / <alpha-value>)',
          soft: 'rgb(var(--accent-soft) / <alpha-value>)',
          contrast: 'rgb(var(--accent-contrast) / <alpha-value>)',
        },
        warning: {
          DEFAULT: 'rgb(var(--warning) / <alpha-value>)',
          soft: 'rgb(var(--warning-soft) / <alpha-value>)',
          contrast: 'rgb(var(--warning-contrast) / <alpha-value>)',
        },
        danger: {
          DEFAULT: 'rgb(var(--danger) / <alpha-value>)',
          soft: 'rgb(var(--danger-soft) / <alpha-value>)',
          contrast: 'rgb(var(--danger-contrast) / <alpha-value>)',
        },
        focus: 'rgb(var(--focus-ring) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
