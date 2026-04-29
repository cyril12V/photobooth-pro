/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Fraunces"', 'serif'],
        script: ['"Allura"', 'cursive'],
        sans: ['"Manrope"', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Teintes festives sophistiquées (modifiables via theme.css)
        midnight: {
          950: '#0a0e1f',
          900: '#0f1530',
          800: '#161e3f',
          700: '#1f2a55',
          600: '#2c3a72',
        },
        gold: {
          DEFAULT: '#d4a574',
          light: '#e8c79a',
          dark: '#b8884f',
        },
        coral: {
          DEFAULT: '#ff8e72',
          light: '#ffaa92',
          dark: '#e26b4f',
        },
        cream: '#faf6ef',
      },
      boxShadow: {
        glow: '0 0 80px -20px rgba(212, 165, 116, 0.5)',
        'glow-strong': '0 0 120px -10px rgba(255, 142, 114, 0.6)',
        soft: '0 4px 30px rgba(0, 0, 0, 0.1)',
        card: '0 20px 60px -15px rgba(0, 0, 0, 0.5)',
      },
      animation: {
        'gradient-shift': 'gradient-shift 20s ease infinite',
        'float': 'float 6s ease-in-out infinite',
        'pulse-soft': 'pulse-soft 3s ease-in-out infinite',
        'fade-in-up': 'fade-in-up 0.6s ease-out',
        'flash': 'flash 0.5s ease-out',
      },
      keyframes: {
        'gradient-shift': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'flash': {
          '0%': { opacity: '0' },
          '20%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
      },
    },
  },
  plugins: [],
};
