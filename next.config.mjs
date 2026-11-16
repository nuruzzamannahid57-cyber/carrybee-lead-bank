/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['*.e2b.app', 'localhost', '127.0.0.1'],
  async headers() {
    return [
      {
        source: '/api/extension/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ];
  },
};

export default nextConfig;
