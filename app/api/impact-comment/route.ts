import { NextResponse } from "next/server";

import { createImpactComment } from "@/lib/gemini";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const orderCount = Number(body?.orderCount ?? 0);
    const co2Kg = Number(body?.co2Kg ?? 0);
    const foodKg = Number(body?.foodKg ?? 0);

    const comment = await createImpactComment(orderCount, co2Kg, foodKg);
    return NextResponse.json({ comment }, { status: 200 });
  } catch (error) {
    console.error("Impact comment route hatasi:", error);
    return NextResponse.json(
      {
        comment:
          "Bu etki, kampuste daha temiz hava ve daha az gida israfi icin guclu bir adim.",
      },
      { status: 200 }
    );
  }
}
