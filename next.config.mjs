/** @type {import('next').NextConfig} */

// Cabeçalhos de segurança aplicados a todas as rotas. A CSP aqui cobre apenas
// frame-ancestors (anti-clickjacking / páginas clonadas embutindo a LP); uma CSP completa
// exigiria mapear GTM, Supabase e a mídia do vídeo antes de ser ativada.
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig = {
  reactStrictMode: true,
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
