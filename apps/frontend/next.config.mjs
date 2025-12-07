/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // Environment variables públicas (prefixo NEXT_PUBLIC_)
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001',
  },

  // SECURITY FIX [SEC-012]: Erros de TypeScript e ESLint devem falhar o build
  // Isso garante que vulnerabilidades detectadas pelo linter sejam corrigidas antes do deploy
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },

  // [P1-4 FIX] Bundle size optimizations for production
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-avatar',
      '@radix-ui/react-toast',
      '@radix-ui/react-select',
      '@radix-ui/react-tabs',
      '@radix-ui/react-popover',
      'date-fns',
    ],
  },

  // Otimizações
  compiler: {
    // Remove console logs in production (except errors and warnings)
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
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
