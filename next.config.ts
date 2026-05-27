/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['127.0.0.1', 'localhost', '192.168.1.18', '192.168.1.38', '192.168.0.0/16'],

  async headers() {
    return [
      {
        source: '/:all*(svg|jpg|jpeg|png|webp|ico|woff2?|ttf)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
        ],
      },
    ]
  },
}

module.exports = nextConfig