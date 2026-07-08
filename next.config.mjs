// CSP construída pro que o app realmente usa — nada de terceiro solto:
// só Supabase (auth/dados/storage, mesmo domínio configurado em
// NEXT_PUBLIC_SUPABASE_URL) e recursos same-origin. Gemini é chamado só
// do servidor (lib/gemini/client.ts, "server-only"), nunca do browser,
// então não precisa entrar aqui. Fontes (next/font/google) são
// baixadas em build e servidas self-hosted — não conectam a fonts.googleapis.com
// em runtime, por isso não aparecem na CSP.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        // Tudo, exceto os assets do PWA (manifest/service worker já
        // servidos com cache-control próprio — não precisam repetir
        // header de segurança de página, e o SW em especial precisa
        // rodar sem restrição de CSP herdada de outra rota).
        source: "/((?!sw.js|manifest.webmanifest).*)",
        headers: [
          { key: "Content-Security-Policy", value: CSP },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "geolocation=(), payment=(), usb=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
    ];
  },
};

export default nextConfig;
