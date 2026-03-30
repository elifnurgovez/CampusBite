import { GoogleGenerativeAI } from "@google/generative-ai";
import type { RequestOptions } from "@google/generative-ai";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const noStore = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
} as const;

const GEMINI_REQUEST_OPTIONS: RequestOptions = { apiVersion: "v1" };

const SYSTEM_PROMPT = `Sen CampusBite uygulamasının 'Eco-Assistant'ısın. Üniversite öğrencilerine hitap ediyorsun.
Artan yemekler için yaratıcı tarifler ver ve sürdürülebilirlik tavsiyeleri sun.
Cevapların kısa, samimi ve motive edici olsun. Emoji kullanmayı unutma! 🌿`;

type IncomingMsg = { role?: string; text?: string };

type GeminiHistoryTurn = {
  role: "user" | "model";
  parts: { text: string }[];
};

/**
 * assistant → model; history dizisi mutlaka 'user' ile başlar — değilse baştan shift ile silinir.
 */
function buildHistoryAndLastUser(messages: IncomingMsg[]): {
  history: GeminiHistoryTurn[];
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

  const history: GeminiHistoryTurn[] = before.map((m) => ({
    role: m.role === "user" ? "user" : "model",
    parts: [{ text: m.text.trim() }],
  }));

  while (history.length > 0 && history[0].role !== "user") {
    history.shift();
  }

  return { history, lastUser };
}

function resolveGeminiApiKey(): string | null {
  const a = process.env.GOOGLE_AI_API_KEY?.trim();
  if (a) return a;
  const b = process.env.NEXT_PUBLIC_GEMINI_API_KEY?.trim();
  if (b) return b;
  return null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawMessages = Array.isArray(body?.messages) ? body.messages : [];
    const { history, lastUser } = buildHistoryAndLastUser(rawMessages);

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
            "Eco-Assistant şu an kullanılamıyor: GOOGLE_AI_API_KEY veya NEXT_PUBLIC_GEMINI_API_KEY tanımlı değil. 🌿",
        },
        { status: 200, headers: noStore }
      );
    }

    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel(
      {
        model: "gemini-2.0-flash",
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
            "Şu an yanıt oluşturulamadı; tekrar dene. 🌿",
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
        reply: `Bağlantı hatası — ayrıntı: ${errMsg}`,
      },
      { status: 200, headers: noStore }
    );
  }
}
