/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        paper: {
          bg: '#FAF7F2',
          sidebar: '#F3EFE6',
          card: '#FFFFFF',
          drawer: '#F6F2E9',
          border: '#E6E1D6',
          text: '#1E1D1A',
          muted: '#6E6A63',
          terracotta: '#B85D3B'
        },
        night: {
          bg: '#141413',
          sidebar: '#1C1C1A',
          card: '#222220',
          drawer: '#191917',
          border: '#302F2C',
          text: '#EAE6DF',
          muted: '#9A958C',
          terracotta: '#D97757'
        }
      },
      fontFamily: {
        serif: ['Songti SC', 'STSong', 'New York', 'Georgia', 'serif'],
        sans: ['-apple-system', 'BlinkMacSystemFont', 'PingFang SC', 'Inter', 'sans-serif']
      }
    }
  },
  plugins: []
};
