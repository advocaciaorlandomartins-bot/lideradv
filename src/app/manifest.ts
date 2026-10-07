import type { MetadataRoute } from "next";

export const dynamic = "force-dynamic";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LiderAdv",
    short_name: "LiderAdv",
    description: "Sistema de Gestão Jurídica para Advogados",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#ffffff",
    theme_color: "#1d4ed8",
    lang: "pt-BR",
    icons: [
      {
        src: "/api/branding/icon?size=192",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/api/branding/icon?size=512",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
    screenshots: [],
    categories: ["productivity", "business"],
  };
}
