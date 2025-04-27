/** @type {import('next').NextConfig} */
const nextConfig = {
    async rewrites() {
        return [
          {
            source: '/api/rpc/:path*', // Match requests to /api/rpc/*
            destination: 'https://coston2-api.flare.network/:path*', // Proxy them to the Flare RPC
          },
        ];
    },
    // Add other Next.js config options here if needed
    // Example:
    // reactStrictMode: true,
};

export default nextConfig; 