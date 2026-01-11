/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/renderer/index.html",
    "./src/renderer/src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // 匹配现有的 Slate 色系
      colors: {
        'slate': {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        },
        'indigo': {
          500: '#4f46e5',
          600: '#4f46e5',
        },
        'red': {
          500: '#ef4444',
        }
      },
      // 自定义间距
      spacing: {
        '18': '4.5rem',
        '72': '18rem',
      },
      // 自定义动画
      animation: {
        'fade-in': 'fadeIn 500ms ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(1rem)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      // 自定义 backdrop blur
      backdropBlur: {
        'xs': '2px',
      },
    },
  },
  plugins: [],
}
