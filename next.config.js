/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';

const nextConfig = {
  output: 'export',
  basePath: isProd ? '/WS1' : '',
  assetPrefix: isProd ? '/WS1/' : '',
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig; 