import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@bnmp/shared', '@bnmp/db', '@bnmp/logger'],
  typedRoutes: true,
  serverExternalPackages: ['@prisma/client', 'pino', 'pino-pretty'],
  webpack: (config) => {
    // Allow NodeNext-style `.js` imports to resolve to source `.ts(x)` files
    // inside our workspace packages (which extend tsconfig.base with module: NodeNext).
    config.resolve = config.resolve ?? {};
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
    };
    return config;
  },
};

export default nextConfig;
