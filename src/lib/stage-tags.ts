import "server-only";
import { db } from "@/db";
import { leadTags, stageTags } from "@/db/schema";
import { and, eq } from "drizzle-orm";

/**
 * « Ceux qui entrent dans cette colonne reçoivent ce tag. »
 *
 * Volontairement séparé de l'automatisation d'email : poser une étiquette et
 * écrire à quelqu'un n'engagent pas la même chose. Une colonne peut faire l'un,
 * l'autre, ou les deux, sans que régler l'un oblige à toucher l'autre.
 */
export async function applyStageTag(leadId: string, statusId: string): Promise<void> {
  try {
    const rule = await db.query.stageTags.findFirst({
      where: and(eq(stageTags.statusId, statusId), eq(stageTags.active, true)),
    });
    if (!rule) return;

    // `lead_tags` a une clé composite (lead, tag) : reposer le même tag ne
    // crée rien et ne casse rien. Un lead qui revient dans la colonne n'a donc
    // pas besoin d'être traité à part.
    await db
      .insert(leadTags)
      .values({ leadId, tagId: rule.tagId })
      .onConflictDoNothing();
  } catch {
    // Le déplacement du lead prime : rater une étiquette ne doit jamais
    // empêcher un glisser-déposer ni un import d'aboutir.
  }
}
