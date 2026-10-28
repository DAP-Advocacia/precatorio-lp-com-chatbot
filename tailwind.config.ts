import type { Config } from 'tailwindcss';

// Preflight desligado: o reset enxuto fica em app/globals.css (não zera margens/estilos de lista).
const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  // Envolve hover: em @media (hover: hover) para o estado não "grudar" após o toque no celular.
  future: {
    hoverOnlyWhenSupported: true,
  },
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      spacing: {
        '4.5': '1.125rem',
        '6.5': '1.625rem',
        '26': '6.5rem',
      },
      transitionDuration: {
        '250': '250ms',
        '450': '450ms',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'sans-serif'],
        mono: ['var(--font-inter)', 'Inter', 'sans-serif'],
      },
      colors: {
        navy: {
          DEFAULT: '#0B1B33',
          deep: '#050B16',
          panel: '#101E38',
          card: '#16233F',
          accent: '#0D1F38',
          border: '#223255',
        },
        porcelain: {
          DEFAULT: '#F5F2EB',
          deep: '#E3DDCF',
        },
        ink: '#1C2331',
        // Todo branco do sistema é porcelain (inclui text-white, bg-white e white/NN).
        white: '#F5F2EB',
        mist: '#F5F2EB',
        cloud: '#EBE7DC',
        sky: '#8FB4EA',
      },
      keyframes: {
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        aiIn: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        infoIn: {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        barGrow: {
          from: { transform: 'scaleX(0)' },
          to: { transform: 'scaleX(1)' },
        },
        spin: {
          to: { transform: 'rotate(360deg)' },
        },
        blink: {
          '0%, 80%, 100%': { opacity: '0.25' },
          '40%': { opacity: '1' },
        },
      },
      animation: {
        fadeUp: 'fadeUp 0.4s cubic-bezier(0.4,0,0.2,1)',
        aiIn: 'aiIn 0.45s cubic-bezier(0.4,0,0.2,1)',
        infoIn: 'infoIn 0.55s cubic-bezier(0.4,0,0.2,1) both',
        barGrow: 'barGrow 0.7s cubic-bezier(0.4,0,0.2,1) 0.6s both',
        spin: 'spin 0.8s linear infinite',
        blink: 'blink 1.2s infinite',
      },
    },
  },
  plugins: [],
};

export default config;
