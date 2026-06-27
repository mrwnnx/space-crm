import { getBootcamps } from "@/lib/queries";
import {
  conversionStats,
  funnelByStage,
  conversionBySource,
  conversionByTemperature,
} from "@/lib/queries";
import { AnalyticsClient } from "./analytics-client";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ bootcamp?: string }>;
}) {
  const { bootcamp } = await searchParams;
  const bootcampId = bootcamp || null;

  const [allBootcamps, stats, funnel, bySource, byTemp] = await Promise.all([
    getBootcamps(),
    conversionStats(bootcampId ?? undefined),
    funnelByStage(bootcampId ?? undefined),
    conversionBySource(bootcampId ?? undefined),
    conversionByTemperature(bootcampId ?? undefined),
  ]);

  const smallSample = stats.convertedCount < 10 && stats.convertedCount > 0;

  return (
    <AnalyticsClient
      stats={stats}
      funnel={funnel}
      bySource={bySource}
      byTemp={byTemp}
      smallSample={smallSample}
      bootcampId={bootcampId}
      bootcamps={allBootcamps.map((b) => ({ id: b.id, name: b.name }))}
    />
  );
}
