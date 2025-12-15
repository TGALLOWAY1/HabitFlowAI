/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: [
    // Safelist text colors corresponding to category bg colors (used in Day View headers)
    {
      pattern: /text-(emerald|violet|rose|amber|blue|fuchsia|cyan|green)-500/,
      variants: ['hover', 'group-hover'],
    },
    // Also likely need bg classes if they aren't explicitly used elsewhere (though they are in predefinedHabits)
    {
      pattern: /bg-(emerald|violet|rose|amber|blue|fuchsia|cyan|green)-500/,
    }
  ],
  theme: {
    extend: {
      colors: {
        // We can add custom colors here later
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
