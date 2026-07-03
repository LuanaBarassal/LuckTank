import type { MetadataRoute } from "next";

// Next.js detecta este arquivo especial e gera /manifest.webmanifest, além de
// injetar o <link rel="manifest"> automaticamente no <head>.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LuckTank",
    short_name: "LuckTank",
    description: "Controle de combustível e anti-fraude para frotas",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f8fafc",
    theme_color: "#0a1628",
    icons: [
      {
        src: "/icons/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
