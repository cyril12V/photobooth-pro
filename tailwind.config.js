/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        // Direction Vogue / éditorial
        editorial: ['"Playfair Display"', '"Bodoni Moda"', 'Didot', 'serif'],
        display: ['"Playfair Display"', '"Bodoni Moda"', 'Didot', 'serif'],
        sans: ['"Inter"', '"Manrope"', 'system-ui', 'sans-serif'],
        signature: ['"Pinyon Script"', '"Allura"', 'cursive'],
        // Garde l'ancienne pour rétrocompat
        script: ['"Pinyon Script"', '"Allura"', 'cursive'],
      },
      colors: {
        // ─── Palette Vogue ────────────────────────────────────────────────
        ivory: {
          DEFAULT: '#F4ECDD',         // crème principale (fond)
          light: '#FAF6EE',           // blanc cassé (highlights)
        },
        beige: {
          DEFAULT: '#E8DCC4',         // beige chaud (accents)
          dark: '#D4B896',            // beige sable (séparateurs / hover)
        },
        editorial: {
          black: '#1A1A1A',           // noir éditorial (titres, CTA)
          charcoal: '#2B2B2B',        // charcoal (admin)
          taupe: '#6B5D4F',           // gris-taupe chaud (texte secondaire)
        },
        // ─── Compat avec l'ancienne palette ──────────────────────────────
        cream: '#F4ECDD',
        midnight: {
          950: '#1A1A1A',
          900: '#2B2B2B',
          800: '#2B2B2B',
          700: '#3a3a3a',
          600: '#4a4a4a',
        },
        gold: {
          DEFAULT: '#D4B896',
          light: '#E8DCC4',
          dark: '#6B5D4F',
        },
        coral: {
          DEFAULT: '#1A1A1A',
          light: '#2B2B2B',
          dark: '#1A1A1A',
        },
      },
      letterSpacing: {
        editorial: '0.1em',
        editorialWide: '0.15em',
        editorialTight: '-0.02em',
      },
      boxShadow: {
        editorial: '0 4px 20px rgba(0, 0, 0, 0.04)',
        'editorial-md': '0 8px 32px rgba(0, 0, 0, 0.06)',
        soft: '0 4px 20px rgba(0, 0, 0, 0.04)',
        card: '0 8px 32px rgba(0, 0, 0, 0.06)',
        glow: '0 4px 20px rgba(0, 0, 0, 0.04)',
        'glow-strong': '0 8px 32px rgba(0, 0, 0, 0.08)',
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.6s ease-out',
        'flash': 'flash 0.5s ease-out',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'flash': {
          '0%': { opacity: '0' },
          '20%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-12px)' },
        },
      },
    },
  },
  plugins: [],
};
