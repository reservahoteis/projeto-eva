/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // Environment variables públicas (prefixo NEXT_PUBLIC_)
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001',
  },

  // Permitir build com warnings de TypeScript e ESLint
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Otimizações
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },

  // Images (caso use WhatsApp media)
  images: {
    domains: [
      'localhost',
      'scontent.whatsapp.net', // WhatsApp CDN
    ],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.fbcdn.net',
      },
    ],
  },

  // Headers de segurança
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
