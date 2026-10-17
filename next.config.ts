import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Listing photos are sent through server actions (resized to ~1024px first).
  experimental: { serverActions: { bodySizeLimit: '6mb' } },
  images: {
    // School logos are served from Supabase Storage
    remotePatterns: [{ protocol: 'https', hostname: '*.supabase.co' }],
  },
};

export default nextConfig;
