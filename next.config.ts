import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Les actions serveur reçoivent 1 Mo au plus par défaut : trop peu pour une
  // brochure PDF donnée à l'assistant WhatsApp. 4,5 Mo = le plafond d'une
  // requête sur Vercel ; au-delà, l'action le dit avant d'envoyer.
  experimental: {
    serverActions: { bodySizeLimit: "4.5mb" },
  },
  // En-têtes de sécurité (audit du 2026-09-20). Pas de CSP pour l'instant :
  // Tiptap et les images inline des emails demandent une vraie recette.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Un CRM authentifié n'a rien à faire dans une iframe tierce
          // (clickjacking). Les aperçus d'email sont en `srcDoc` : non concernés.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Les liens sortants (Luma, WordPress…) ne reçoivent que l'origine.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
