import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
