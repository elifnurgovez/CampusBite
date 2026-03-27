import { NextResponse } from "next/server";

import { createSandwichComment } from "@/lib/gemini";

/** Next.js bu route yanıtını önbelleğe almasın. */
export const dynamic = "force-dynamic";
export const revalidate = 0;

const noStore = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
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
      const fallback = "Lezzetiyle dikkat ceken guzel bir kampus secenegi.";
      return NextResponse.json(
        { comment: fallback, text: fallback, impact_score: 50 },
        { status: 200, headers: noStore }
      );
    }

    const { text, impact_score } = await createSandwichComment(
      name,
      category,
      variationHint,
      productId
    );
    return NextResponse.json(
      { comment: text, text, impact_score },
      { status: 200, headers: noStore }
    );
  } catch (error) {
    console.error("Gemini route hatasi:", error);
    const fallback = "Lezzetiyle dikkat ceken guzel bir kampus secenegi.";
    return NextResponse.json(
      { comment: fallback, text: fallback, impact_score: 50 },
      { status: 200, headers: noStore }
    );
  }
}
