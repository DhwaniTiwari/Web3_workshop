/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    // Suppress warnings from packages that reference react-native internals
    config.resolve.alias = {
      ...config.resolve.alias,
      '@react-native-async-storage/async-storage': false,
    };

    config.externals.push(
      'pino-pretty',
      'lokijs',
      'encoding',
      '@x402/evm',
      '@x402/core',
      '@x402/svm',
      '@coinbase/cdp-sdk'
    );
    return config;
  },
};

export default nextConfig;

