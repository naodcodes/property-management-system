const createNextIntlPlugin = require('next-intl/plugin');

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@property-management/types'],
  
  async rewrites() {
    return [
      {
        // Changed destination port from 3001 to 4000 to match your API
        source: '/api/:path*',
        destination: 'http://127.0.0.1:4000/api/:path*', 
      },
    ];
  },
};

module.exports = withNextIntl(nextConfig);