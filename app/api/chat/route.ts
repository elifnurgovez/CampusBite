import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const noStore = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
} as const;

const geminiApiKey =
  process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;

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

    if (!geminiApiKey?.trim()) {
      return NextResponse.json(
        {
          reply:
            "Şu an Eco-Assistant bağlantısı kurulamadı. Biraz sonra tekrar dene — bu arada mutfakta israfı azaltmak için küçük porsiyonlar ve kapaklı tencere kullanmak iyi bir başlangıç! 🌿",
        },
        { status: 200, headers: noStore }
      );
    }

    const client = new GoogleGenerativeAI(geminiApiKey.trim());
    const model = client.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction: SYSTEM_PROMPT,
    });

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
