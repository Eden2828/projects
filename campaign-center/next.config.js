/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [
      'graph.facebook.com',
      'scontent.xx.fbcdn.net',
      'lookaside.fbsbx.com',
      'z-p3-scontent.xx.fbcdn.net',
    ],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.fbcdn.net',
      },
      {
        protocol: 'https',
        hostname: '**.facebook.com',
      },
    ],
  },
  serverExternalPackages: ['jspdf', 'pptxgenjs'],
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: process.env.ALLOWED_ORIGIN || '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,PATCH,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Content-Type, Authorization' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
