/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === "production";
const nextConfig = {
  reactStrictMode: true,
  // Static export so the chatbot can ship on GitHub Pages.
  output: "export",
  // basePath only applies in prod build; local `next dev` keeps the root URL.
  basePath: isProd ? "/sworn/demo" : "",
  assetPrefix: isProd ? "/sworn/demo/" : "",
  trailingSlash: true,
  images: { unoptimized: true },
  transpilePackages: ["@sworn/sdk"],
};
export default nextConfig;
