import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["cubing"],
  outputFileTracingIncludes: {
    "/api/grouping/**": ["./node_modules/cubing/dist/lib/cubing/**/*"],
  },
  async redirects() {
    return [
      { source: "/admin/create/competition", destination: "/admin/competitions/new", permanent: false },
      { source: "/admin/create/competitor", destination: "/admin/competitors/new", permanent: false },
      { source: "/admin/update", destination: "/admin/competitions", permanent: false },
      { source: "/admin/update/:slug", destination: "/admin/competitions/:slug/results/edit", permanent: false },
      { source: "/admin/update/:slug/:section", destination: "/admin/competitions/:slug/:section", permanent: false },
    ];
  },
};

export default nextConfig;
