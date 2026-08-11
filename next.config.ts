import type { NextConfig } from "next";

/**
 * Response headers the browser acts on. Each one is a short instruction that
 * makes the browser safer. Vercel already sends Strict-Transport-Security, so
 * it is not repeated here.
 *
 * There is no Content-Security-Policy. Next puts inline scripts in the page, so
 * a strict policy blocks them and breaks the site. Making it work needs nonce
 * plumbing on every page, which pays off once the site has accounts or
 * visitor-submitted content. It has neither.
 */
const securityHeaders = [
  /** Trust the Content-Type the server sent. Do not inspect and guess. */
  { key: "X-Content-Type-Options", value: "nosniff" },
  /**
   * Refuse to be framed by another origin. Stops clickjacking, where a third
   * party covers this site with their own buttons. SAMEORIGIN rather than DENY,
   * so the site can still embed its own pages.
   */
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  /** Send the origin, not the full path, when a visitor leaves the site. */
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  /** The site needs none of these, so no page may ask for them. */
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  images: {
    /**
     * Keep this list narrow. An open pattern turns the image optimizer into a
     * proxy that anyone can point at any host.
     */
    remotePatterns: [
      {
        protocol: "https",
        hostname: "assets.nhle.com",
      },
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
