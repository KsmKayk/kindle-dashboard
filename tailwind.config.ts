import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#1a1612',
          soft: '#3a342c',
          muted: '#7a7268',
          light: '#a89e90',
        },
        paper: {
          DEFAULT: '#e8e3d8',
          light: '#f1ede2',
          dark: '#d8d2c4',
          darker: '#c4bdac',
        },
      },
      fontFamily: {
        serif: ['Georgia', '"Times New Roman"', 'serif'],
        sans: ['"Helvetica Neue"', 'Arial', 'sans-serif'],
      },
      borderRadius: {
        card: '10px',
        tile: '6px',
      },
    },
  },
  plugins: [],
}

export default config
