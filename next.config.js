/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: '/DynamicOpenArchive',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  // Reduce noisy webpack cache restoration warnings in development
  webpack: (config, { dev }) => {
    if (dev) {
      // Use in-memory cache during dev to avoid PackFileCacheStrategy restore errors
      config.cache = { type: 'memory' }
    }
    return config
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
}

module.exports = nextConfig