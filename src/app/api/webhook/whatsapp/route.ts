import { NextRequest, NextResponse } from "next/server";
import { applyWhatsAppStatus, ingestInboundWhatsApp, type MediaEntrant } from "@/lib/whatsapp-inbox";
import { MEDIA_KINDS } from "@/lib/messaging/whatsapp-media";

/**
 * Le webhook WhatsApp de Meta — remplace celui de Twilio.
 *
 * Deux méthodes, deux rôles :
 *
 * **GET** — la poignée de main. Meta appelle cette URL une fois, avec un défi,
 * et n'enregistre l'abonnement que si on lui renvoie le défi EN TEXTE BRUT.
 * Une réponse JSON échoue, même avec la bonne valeur.
 *
 * **POST** — les événements. Deux familles arrivent ici : les messages entrants
 * (une réponse d'un lead) et les changements de statut (envoyé, livré, lu,
 * échec), rattachés à la bulle par le wamid via `whatsapp_messages`.
 *
 * ⚠️ Meta considère toute réponse non-200 comme un échec et **réessaie**. On
 * répond donc 200 même quand on ne sait pas quoi faire d'un événement : un 500
 * sur un cas non géré déclencherait des relances sans fin.
 */

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const mode = p.get("hub.mode");
  const token = p.get("hub.verify_token");
  const challenge = p.get("hub.challenge");

  const attendu = process.env.WHATSAPP_VERIFY_TOKEN;
  if (!attendu) {
    return NextResponse.json({ error: "WHATSAPP_VERIFY_TOKEN absent" }, { status: 500 });
  }
  if (mode === "subscribe" && token === attendu && challenge) {
    // Texte brut, sans guillemets : c'est la seule forme que Meta accepte.
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }
  return NextResponse.json({ error: "Vérification refusée" }, { status: 403 });
}

type MediaMeta = { id?: string; mime_type?: string; caption?: string; filename?: string };
type Entrant = {
  from?: string;
  type?: string;
  text?: { body?: string };
  image?: MediaMeta;
  video?: MediaMeta;
  audio?: MediaMeta;
  document?: MediaMeta;
  sticker?: MediaMeta;
  // Une réponse par bouton de modèle arrive ici, pas dans `text`.
  button?: { text?: string; payload?: string };
  interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } };
};

/** Le texte lisible d'un message entrant, quel que soit son type. */
function texteDe(m: Entrant): string {
  if (m.text?.body) return m.text.body;
  if (m.button?.text) return m.button.text;
  const i = m.interactive;
  if (i?.button_reply?.title) return i.button_reply.title;
  if (i?.list_reply?.title) return i.list_reply.title;
  return m.type ? `[${m.type} reçu, non lisible dans le CRM]` : "[message vide]";
}

/** La pièce jointe d'un message entrant, s'il en porte une. */
function mediaDe(m: Entrant): MediaEntrant | null {
  const kind = MEDIA_KINDS.find((k) => k === m.type);
  const meta = kind ? m[kind] : undefined;
  if (!kind || !meta?.id) return null;
  return { kind, mediaId: meta.id, caption: meta.caption ?? null, filename: meta.filename ?? null };
}

// Rapatrier une vidéo de 16 Mo peut dépasser les 10 s par défaut.
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const corps = (await request.json()) as {
      entry?: {
        changes?: {
          value?: {
            messages?: Entrant[];
            statuses?: {
              id?: string;
              status?: string;
              errors?: { code?: number; title?: string; message?: string }[];
            }[];
            contacts?: { profile?: { name?: string } }[];
          };
        }[];
      }[];
    };

    let recus = 0;
    let leadsCrees = 0;
    let statuts = 0;

    for (const entry of corps.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const v = change.value;

        // Les accusés : envoyé, livré, lu, échec — un par message, par wamid.
        for (const st of v?.statuses ?? []) {
          if (!st.id || !st.status) continue;
          await applyWhatsAppStatus({ wamid: st.id, status: st.status, errors: st.errors });
          statuts++;
        }

        if (!v?.messages?.length) continue;

        const nom = v.contacts?.[0]?.profile?.name ?? null;

        for (const m of v.messages) {
          if (!m.from) continue;
          // Rattachement au lead — ou création du lead si le numéro est inconnu.
          // Tout est dans src/lib/whatsapp-inbox.ts, seul point d'entrée d'un
          // message reçu. Une photo, un vocal, un PDF y sont rapatriés.
          const r = await ingestInboundWhatsApp({
            from: m.from,
            profileName: nom,
            text: texteDe(m),
            media: mediaDe(m),
          });
          recus++;
          if (r.leadCreated) leadsCrees++;
        }
      }
    }

    return NextResponse.json({ ok: true, recus, leadsCrees, statuts });
  } catch (err) {
    console.error("Webhook WhatsApp :", err);
    // 200 volontaire : voir l'en-tête. Une erreur de notre côté ne doit pas
    // provoquer des relances en boucle chez Meta.
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
