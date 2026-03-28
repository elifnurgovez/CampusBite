import { NextResponse } from "next/server";

import { createSandwichComment } from "@/lib/gemini";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

/** Next.js bu route yanıtını önbelleğe almasın. */
export const dynamic = "force-dynamic";
export const revalidate = 0;

const noStore = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
} as const;

const fallbackBody = {
  comment: "Lezzetiyle dikkat ceken guzel bir kampus secenegi.",
  text: "Lezzetiyle dikkat ceken guzel bir kampus secenegi.",
  impact_score: 50,
  water_liters: 2.1,
  co2_grams: 220,
  green_score: 50,
  daily_tip:
    "Bugun mevsim urunlerini tercih etmek hem lezzet hem cevre icin iyi bir adim.",
} as const;

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
      });
      if (scanErr) {
        console.error("scans insert:", scanErr.message);
      }
    }

    return NextResponse.json(
      {
        comment: analysis.text,
        text: analysis.text,
        impact_score: analysis.impact_score,
        water_liters: analysis.water_liters,
        co2_grams: analysis.co2_grams,
        green_score: analysis.green_score,
        daily_tip: analysis.daily_tip,
      },
      { status: 200, headers: noStore }
    );
  } catch (error) {
    console.error("Gemini route hatasi:", error);
    return NextResponse.json(fallbackBody, { status: 200, headers: noStore });
  }
}
