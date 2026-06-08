/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // HSTS in production only — adds the policy after a couple of clean HTTPS rollouts.
  ...(isProd
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }]
    : []),
];

const baseConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Emits a self-contained .next/standalone bundle that runs with just
  // `node server.js` — used by the Dockerfile to keep the runtime image small.
  output: 'standalone',
  experimental: {
    // Heavy / optional Node-only packages — kept as runtime externals so
    // webpack doesn't try to bundle them. `googleapis`, `google-auth-library`,
    // `firebase-admin` and `nodemailer` are all optional integrations
    // (Play Billing, Google sign-in, FCM push, SMTP) — leaving them
    // external means a build succeeds even when they aren't installed,
    // and they're loaded lazily at runtime when their feature is used.
    serverComponentsExternalPackages: [
      'mongoose',
      'bcryptjs',
      'winston',
      'nodemailer',
      'googleapis',
      'google-auth-library',
      'firebase-admin',
      'stripe',
      // Optional integrations — externalized so the build succeeds when
      // they aren't installed, and they're require()'d lazily at runtime
      // when their feature path executes (AI insights, Plaid bank sync,
      // OCR via Cloud Vision, receipt storage on R2/S3).
      '@anthropic-ai/sdk',
      'plaid',
      '@google-cloud/vision',
      '@aws-sdk/client-s3',
    ],
  },
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
};

// Wrap with @next/bundle-analyzer only when ANALYZE=true. Keeps the dep
// optional for normal builds.
const withMaybeAnalyzer = async () => {
  if (process.env.ANALYZE !== 'true') return baseConfig;
  try {
    const { default: withBundleAnalyzer } = await import('@next/bundle-analyzer');
    return withBundleAnalyzer({ enabled: true })(baseConfig);
  } catch {
    return baseConfig;
  }
};

export default await withMaybeAnalyzer();
