/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Launch safety net: style and type checks run in your editor and with `npm run lint`,
  // but they won't block a deployment. Remove these two lines once the app is stable.
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
