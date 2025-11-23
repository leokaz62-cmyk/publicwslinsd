/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Thème sombre premium avec accents dorés
        bg: {
          primary: '#0d0d0d',
          alt: '#141414',
          card: '#141414',
        },
        gold: {
          DEFAULT: '#d4af37',
          light: '#e4c45c',
          dark: '#b8941f',
        },
        text: {
          primary: '#f7f7f7',
          muted: '#cfcfcf',
        },
      },
      fontFamily: {
        sans: ['Poppins', 'sans-serif'],
        serif: ['Merriweather', 'serif'],
      },
      borderRadius: {
        'custom': '16px',
      },
      maxWidth: {
        'container': '1200px',
      },
      boxShadow: {
        // Ombres harmonisées - style premium sobre
        'subtle': '0 4px 12px rgba(0, 0, 0, 0.3), 0 2px 4px rgba(0, 0, 0, 0.2)',
        'subtle-hover': '0 6px 16px rgba(0, 0, 0, 0.4), 0 2px 6px rgba(0, 0, 0, 0.3)',
        // Glow doré très discret (conservé pour compatibilité mais réduit)
        'gold': '0 2px 8px rgba(212, 175, 55, 0.15)',
        'gold-hover': '0 4px 12px rgba(212, 175, 55, 0.2), 0 0 8px rgba(212, 175, 55, 0.1)',
      },
    },
  },
  plugins: [],
}

