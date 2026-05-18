/** @type {import('next').NextConfig} */
const nextConfig = {
  // Root path is now handled by src/app/page.tsx (smart redirect based on
  // Clerk auth state). The previous `/` → `/dashboard` permanent redirect
  // would bounce signed-out users through a Clerk-protected route only to
  // immediately redirect them to /sign-in — wasteful.
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "img.clerk.com",
      },
    ],
  },
  // Next.js 16: silence Turbopack warning while webpack config (node: scheme rewriter)
  // remains for production builds. Both paths produce equivalent output for our usage.
  turbopack: {},
  webpack: (webpackConfig, { webpack }) => {
    webpackConfig.plugins.push(
      // Remove node: from import specifiers, because Next.js does not yet support node: scheme
      // https://github.com/vercel/next.js/issues/28774
      new webpack.NormalModuleReplacementPlugin(/^node:/, (resource) => {
        resource.request = resource.request.replace(/^node:/, "");
      }),
    );

    return webpackConfig;
  },
};

module.exports = nextConfig;
