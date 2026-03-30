import { NextResponse } from "next/server";

import {
  createSandwichComment,
  DEFAULT_FALLBACK_ANALYSIS,
  type SustainabilityAnalysis,
} from "@/lib/gemini";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

/** Next.js bu route yanıtını önbelleğe almasın. */
export const dynamic = "force-dynamic";
export const revalidate = 0;

const noStore = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
} as const;

function analysisToJsonBody(a: SustainabilityAnalysis) {
  return {
    comment: a.text,
    text: a.text,
    impact_score: a.impact_score,
    water_liters: a.water_liters,
    co2_avoided: a.co2_avoided,
    green_score: a.green_score,
    daily_tip: a.daily_tip,
  };
}

const fallbackBody = analysisToJsonBody(DEFAULT_FALLBACK_ANALYSIS);

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const idFromQuery = searchParams.get("id")?.trim() ?? "";

    const body = await request.json();
    const productId =
      (typeof body?.id === "string" && body.id.trim()) || idFromQuery || "";

    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const category =
      typeof body?.category === "string" && body.category.trim()
        ? body.category.trim()
        : "Genel";
    const variationHint =
      typeof body?.variationHint === "string" && body.variationHint.trim()
        ? body.variationHint.trim()
        : `${name}-${Date.now()}`;

    if (!name) {
      return NextResponse.json(fallbackBody, { status: 200, headers: noStore });
    }

    const analysis = await createSandwichComment(
      name,
      category,
      variationHint,
      productId
    );

    if (isSupabaseConfigured) {
      const { error: scanErr } = await supabase.from("scans").insert({
        product_name: name,
        impact_score: analysis.impact_score,
        product_id: productId || null,
        water_liters: analysis.water_liters,
        co2_avoided: analysis.co2_avoided,
      });
      if (scanErr) {
        console.error("scans insert:", scanErr.message);
      }
    }

    return NextResponse.json(analysisToJsonBody(analysis), {
      status: 200,
      headers: noStore,
    });
  } catch (error) {
    console.error("Gemini route hatasi:", error);
    return NextResponse.json(fallbackBody, { status: 200, headers: noStore });
  }
}
