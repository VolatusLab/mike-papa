import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@bnmp/shared', '@bnmp/db', '@bnmp/logger'],
  typedRoutes: true,
};

export default nextConfig;
