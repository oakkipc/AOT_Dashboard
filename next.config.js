/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  // ปรับการตั้งค่าตามมาตรฐาน Next.js 16
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;