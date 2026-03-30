import { GoogleGenerativeAI } from "@google/generative-ai";
import type { RequestOptions } from "@google/generative-ai";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const noStore = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
} as const;

/** v1beta: systemInstruction alanı v1’de tanınmıyor; EcoChat system prompt için gerekli */
const GEMINI_REQUEST_OPTIONS: RequestOptions = { apiVersion: "v1beta" };

const ECOCHAT_MODEL = "gemini-3-flash";

/**
 * GOOGLE_AI_API_KEY veya NEXT_PUBLIC_GEMINI_API_KEY: en az biri dolu olmalı.
 * Öncelik: sunucu anahtarı (GOOGLE_AI_API_KEY), yoksa public.
 */
function resolveGeminiApiKey(): string | null {
  const fromGoogle = process.env.GOOGLE_AI_API_KEY?.trim();
  if (fromGoogle) return fromGoogle;
  const fromPublic = process.env.NEXT_PUBLIC_GEMINI_API_KEY?.trim();
  if (fromPublic) return fromPublic;
  return null;
}

/** EcoChat / Eco-Assistant — Gemini systemInstruction */
const SYSTEM_PROMPT = `Sen CampusBite uygulamasının 'Eco-Assistant'ısın. Üniversite öğrencilerine hitap ediyorsun.

Kullanıcı artan yemekleri sorarsa (Örn: 'Kalan makarnayla ne yapılır?'), onlara yaratıcı, hızlı ve israfsız tarifler ver.

Sürdürülebilirlik tavsiyeleri ver (Örn: 'Yurtta nasıl daha az enerji harcarım?').

Cevapların her zaman kısa, samimi ve motive edici olsun. Emoji kullanmayı unutma! 🌿`;

type IncomingMsg = { role?: string; text?: string };

function splitForChat(messages: IncomingMsg[]): {
  history: { role: "user" | "model"; parts: { text: string }[] }[];
  lastUser: string;
} {
  const list = messages.filter(
    (m) =>
      (m.role === "user" || m.role === "assistant") &&
      typeof m.text === "string" &&
      m.text.trim().length > 0
  ) as { role: "user" | "assistant"; text: string }[];

  let i = 0;
  while (i < list.length && list[i].role !== "user") i++;
  const rest = list.slice(i);
  if (rest.length === 0 || rest[rest.length - 1].role !== "user") {
    return { history: [], lastUser: "" };
  }
  const lastUser = rest[rest.length - 1].text.trim();
  const before = rest.slice(0, -1);
  const history: { role: "user" | "model"; parts: { text: string }[] }[] =
    [];
  for (const m of before) {
    history.push({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.text.trim() }],
    });
  }
  return { history, lastUser };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawMessages = Array.isArray(body?.messages) ? body.messages : [];
    const { history, lastUser } = splitForChat(rawMessages);

    if (!lastUser || lastUser.length > 4000) {
      return NextResponse.json(
        { error: "Geçerli bir mesaj gerekli." },
        { status: 400, headers: noStore }
      );
    }

    const apiKey = resolveGeminiApiKey();
    if (!apiKey) {
      return NextResponse.json(
        {
          reply:
            "Şu an Eco-Assistant bağlantısı kurulamadı: GOOGLE_AI_API_KEY veya NEXT_PUBLIC_GEMINI_API_KEY tanımlı değil. Biraz sonra tekrar dene — bu arada mutfakta israfı azaltmak için küçük porsiyonlar ve kapaklı tencere kullanmak iyi bir başlangıç! 🌿",
        },
        { status: 200, headers: noStore }
      );
    }

    const client = new GoogleGenerativeAI(apiKey);

    const model = client.getGenerativeModel(
      {
        model: ECOCHAT_MODEL,
        systemInstruction: SYSTEM_PROMPT,
      },
      GEMINI_REQUEST_OPTIONS
    );

    const chat = model.startChat({
      history,
      generationConfig: {
        temperature: 0.85,
        maxOutputTokens: 1024,
      },
    });

    const result = await chat.sendMessage(lastUser);
    const reply = result.response.text().trim();
    if (!reply) {
      return NextResponse.json(
        {
          reply:
            "Kısa bir gecikme oldu; tekrar yazarsan sevinirim! Kampüste bugün de sürdürülebilir bir seçim yapabilirsin. 🌿",
        },
        { status: 200, headers: noStore }
      );
    }

    return NextResponse.json({ reply }, { status: 200, headers: noStore });
  } catch (error) {
    console.error("EcoChat API:", error);
    const errMsg =
      error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        reply: `Bir şeyler ters gitti. Tekrar dene; bu arada buzdolabındaki artıkları tek kapta değerlendirmek harika bir fikir olabilir! 🌿 [Hata: ${errMsg}]`,
      },
      { status: 200, headers: noStore }
    );
  }
}
