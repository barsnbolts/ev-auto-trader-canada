/** @type {import('next').NextConfig} */
//
// Two build targets:
//   default                — Vercel SSR. Server components, force-dynamic OK,
//                            cookies via next/headers, next/image optimizer.
//   BUILD_TARGET=tauri     — fully static bundle for Tauri shell.
//                            output:'export' + unoptimized images +
//                            trailingSlash for WKWebView file:// routing.
//
// Per-route SSR vs static decisions live in each page; the env flag flips
// the build pipeline only.
//
const isTauri = process.env.BUILD_TARGET === "tauri";

const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: isTauri,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "upload.wikimedia.org",
        pathname: "/wikipedia/commons/**",
      },
    ],
  },
  ...(isTauri
    ? {
        output: "export",
        trailingSlash: true,
        distDir: "out",
      }
    : {}),
};

export default nextConfig;
