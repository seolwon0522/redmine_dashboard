import type { Config } from 'tailwindcss'

const config: Config = {
  // Tailwind가 스캔할 파일 경로
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      // 모달 등장 애니메이션
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        slideIn: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 0.15s ease-out',
        slideUp: 'slideUp 0.2s ease-out',
        slideIn: 'slideIn 0.2s ease-out',
      },
    },
  },
  plugins: [],
}

export default config
