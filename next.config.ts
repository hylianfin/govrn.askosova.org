import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: false,
  partialPrefetching: false,
  async redirects() {
    // The platform is reduced to candidates, counting and the integrity numbers. The other pages stay in the code but are not reachable.
    const to = (sources: string[], destination: string) => sources.map((source) => ({ source, destination, permanent: false }));
    return [
      ...to(["/executive-team", "/senate", "/election-timeline", "/announcements", "/candidates"], "/"),
      ...to(["/sign-up"], "/sign-in"),
      ...to(["/dashboard/:path+"], "/"),
      ...to(["/staff/:path*"], "/admin"),
      ...to(["/admin/elections", "/admin/timeline", "/admin/eligibility-rules", "/admin/forms/:path*", "/admin/polling-desk", "/admin/practice", "/admin/roles"], "/admin"),
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
