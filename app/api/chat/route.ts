import {
  GoogleGenerativeAI,
  GoogleGenerativeAIFetchError,
} from "@google/generative-ai";
import type { RequestOptions } from "@google/generative-ai";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const noStore = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
} as const;

const GEMINI_REQUEST_OPTIONS: RequestOptions = { apiVersion: "v1" };

/** systemInstruction kullanılmaz; metin kullanıcı mesajının başına eklenir */
const SYSTEM_PROMPT = `Sen CampusBite uygulamasının 'Eco-Assistant'ısın. Üniversite öğrencilerine hitap ediyorsun.
Artan yemekler için yaratıcı tarifler ver ve sürdürülebilirlik tavsiyeleri sun.
Cevapların kısa, samimi ve motive edici olsun. Emoji kullanmayı unutma! 🌿`;

const MODEL_ID = "gemini-1.5-flash";

type IncomingMsg = { role?: string; text?: string };

function getLastUserMessage(messages: IncomingMsg[]): string {
  const users = messages.filter(
    (m) =>
      m.role === "user" &&
      typeof m.text === "string" &&
      m.text.trim().length > 0
  );
  if (users.length === 0) return "";
  return users[users.length - 1].text!.trim();
}

function resolveGeminiApiKey(): string | null {
  const a = process.env.GOOGLE_AI_API_KEY?.trim();
  if (a) return a;
  const b = process.env.NEXT_PUBLIC_GEMINI_API_KEY?.trim();
  if (b) return b;
  return null;
}

function friendlyFetchError(status: number | undefined, message: string): string {
  if (status === 429) {
    return `İstek limiti (429): Çok sık mesaj gönderildi veya kotanız doldu. Bir süre bekleyip tekrar dene. Ayrıntı: ${message}`;
  }
  if (status === 404) {
    return `Model bulunamadı (404): ${MODEL_ID} bu anahtar veya bölge için uygun olmayabilir. Ayrıntı: ${message}`;
  }
  if (status === 400) {
    return `Geçersiz istek (400): Mesaj çok uzun veya parametre uyumsuz olabilir. Ayrıntı: ${message}`;
  }
  return `Bağlantı hatası — ayrıntı: ${message}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawMessages = Array.isArray(body?.messages) ? body.messages : [];
    const lastUserMsg = getLastUserMessage(rawMessages);

    if (!lastUserMsg) {
      return NextResponse.json(
        { error: "Geçerli bir kullanıcı mesajı gerekli." },
        { status: 400, headers: noStore }
      );
    }

    if (lastUserMsg.length > 32000) {
      return NextResponse.json(
        { error: "Mesaj çok uzun (maks. yaklaşık 32.000 karakter)." },
        { status: 400, headers: noStore }
      );
    }

    const apiKey = resolveGeminiApiKey();
    if (!apiKey) {
      return NextResponse.json(
        {
          reply:
            "Eco-Assistant kullanılamıyor: GOOGLE_AI_API_KEY veya NEXT_PUBLIC_GEMINI_API_KEY tanımlı değil. 🌿",
        },
        { status: 200, headers: noStore }
      );
    }

    const fullPrompt = `${SYSTEM_PROMPT}\n\nKullanıcı mesajı: ${lastUserMsg}`;

    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel(
      { model: MODEL_ID },
      GEMINI_REQUEST_OPTIONS
    );

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
      generationConfig: {
        temperature: 0.85,
        maxOutputTokens: 1024,
      },
    });

    const reply = result.response.text().trim();
    if (!reply) {
      return NextResponse.json(
        { reply: "Şu an yanıt oluşturulamadı; tekrar dene. 🌿" },
        { status: 200, headers: noStore }
      );
    }

    return NextResponse.json({ reply }, { status: 200, headers: noStore });
  } catch (error) {
    console.error("EcoChat API:", error);

    if (error instanceof GoogleGenerativeAIFetchError) {
      const msg = error.message || String(error);
      return NextResponse.json(
        {
          reply: friendlyFetchError(error.status, msg),
        },
        { status: 200, headers: noStore }
      );
    }

    const errMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { reply: `Hata: ${errMsg}` },
      { status: 200, headers: noStore }
    );
  }
}
