import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import { asRange, summarize } from "@/lib/insights";
import { loadInsights } from "@/lib/insights-server";
import { buildReport } from "@/lib/pdf/report";

// GET /insights/report?days=30 → the signed-in person's report as a PDF download.
export async function GET(request: NextRequest) {
  const { supabase, user, profile } = await getCurrentUser();
  if (!user || !profile) return NextResponse.redirect(new URL("/login?next=/insights", request.url));

  const range = asRange(request.nextUrl.searchParams.get("days"));
  const data = await loadInsights(supabase, user.id, profile);
  const summary = summarize(data, range);
  const bytes = await buildReport(summary, { name: profile.full_name || "You", site: request.nextUrl.host });

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="lockin-report-${range}-days-${summary.today}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
