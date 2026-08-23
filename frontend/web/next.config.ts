import type { NextConfig } from "next";

// The browser calls the NestJS backend directly, so its origin has to be in
// connect-src or CSP blocks every request before CORS is even consulted.
// Origin only — CSP matches on origin, and a path here would never match.
function apiOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4001";
  try {
    return new URL(raw).origin;
  } catch {
    return "http://localhost:4001";
  }
}

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(self), geolocation=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https://*.googleusercontent.com",
      "font-src 'self' data:",
      `connect-src 'self' ${apiOrigin()}`,
      "frame-src https://js.stripe.com https://checkout.stripe.com",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  experimental: {
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
