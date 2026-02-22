/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        iosbg: '#0b0b0c',
        ioscard: '#111113',
        iosborder: '#1f1f22',
        iostext: '#e6e6e7',
        iossub: '#a1a1a6'
      },
      borderRadius: {
        xl: '1rem',
      },
      boxShadow: {
        ios: '0 1px 0 0 rgba(255,255,255,0.05) inset, 0 0 0 1px rgba(255,255,255,0.04) inset',
      }
    },
  },
  plugins: [],
}



