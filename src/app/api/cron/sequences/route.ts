import { NextRequest, NextResponse } from "next/server";
import { runSequenceRunner } from "@/lib/sequences";

export async function GET(request: NextRequest) {
  // ── Auth via Bearer token or ?secret= ──────────────
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.replace("Bearer ", "");
  const querySecret = request.nextUrl.searchParams.get("secret");

  const expectedSecret = process.env.CRON_SECRET;
  if (expectedSecret && bearerToken !== expectedSecret && querySecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const results = await runSequenceRunner();
    return NextResponse.json({
      ok: true,
      ...results,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[cron] Sequence runner failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
