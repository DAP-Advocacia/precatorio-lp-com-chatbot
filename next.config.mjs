/** @type {import('next').NextConfig} */

// Cabeçalhos de segurança aplicados a todas as rotas. A CSP aqui cobre apenas
// frame-ancestors (anti-clickjacking / páginas clonadas embutindo a LP); uma CSP completa
// exigiria mapear GTM, Vercel Blob (vídeo) e OpenAI/Bitrix antes de ser ativada.
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig = {
  reactStrictMode: true,
  // Rotas antigas do teste A/B: o chat passou para a home e o stepper para /antecipar.
  async redirects() {
    return [
      { source: '/chat', destination: '/', permanent: false },
      { source: '/antecipe', destination: '/antecipar', permanent: false },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
