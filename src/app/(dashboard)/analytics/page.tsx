import {
  conversionStats,
  funnelByStage,
  conversionBySource,
  conversionByTemperature,
} from "@/lib/queries";
import { AnalyticsClient } from "./analytics-client";

export const dynamic = "force-dynamic";

/**
 * La vue GÉNÉRALE, toutes formations confondues — pour comparer les sessions.
 * Les statistiques d'une formation vivent dans la formation elle-même.
 */
export default async function AnalyticsPage() {
  const [stats, funnel, bySource, byTemp] = await Promise.all([
    conversionStats(),
    funnelByStage(),
    conversionBySource(),
    conversionByTemperature(),
  ]);

  const smallSample = stats.convertedCount < 10 && stats.convertedCount > 0;

  return (
    <AnalyticsClient
      stats={stats}
      funnel={funnel}
      bySource={bySource}
      byTemp={byTemp}
      smallSample={smallSample}
    />
  );
}
