/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // ExcelJS uses some Node.js modules — disable them in the browser build
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        stream: false,
        crypto: false,
      }
    }
    return config
  },
}
module.exports = nextConfig
