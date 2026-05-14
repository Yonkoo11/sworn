/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@sworn/sdk"],
  experimental: {
    serverComponentsExternalPackages: ["ethers"]
  }
};

export default nextConfig;
