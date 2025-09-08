/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Enable React 19 features
    reactCompiler: true,
    ppr: true,
    typedRoutes: true,
    optimizePackageImports: ['@radix-ui/*', 'lucide-react', 'recharts'],
  },
  transpilePackages: [
    '@snoball/ui',
    '@snoball/shared-types',
    '@snoball/trading-core',
  ],
  images: {
    domains: ['api.alpaca.markets'],
  },
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
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;