import { GoogleGenerativeAI } from "@google/generative-ai";
import type { RequestOptions } from "@google/generative-ai";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const geminiApiKey =
  process.env.GOOGLE_AI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

const GEMINI_REQUEST_OPTIONS: RequestOptions = { apiVersion: "v1" };

// Bu senin asistanının kişiliği
const SYSTEM_PROMPT = `Sen CampusBite Eco-Assistant'ısın. Üniversite öğrencilerine artan yemekler için yaratıcı tarifler ver. Cevapların kısa, samimi ve bol emojili olsun. 🌿🥪`;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const messages = Array.isArray(body?.messages) ? body.messages : [];
    const lastUserMsg =
      messages.length > 0 ? messages[messages.length - 1]?.text || "Selam!" : "Selam!";

    if (!geminiApiKey?.trim()) throw new Error("API ANAHTARI BULUNAMADI");

    const genAI = new GoogleGenerativeAI(geminiApiKey.trim());
    // 2.0-flash senin anahtarınla en uyumlu olan model
    const model = genAI.getGenerativeModel(
      { model: "gemini-2.0-flash" },
      GEMINI_REQUEST_OPTIONS
    );

    // Hata riskini sıfıra indiren 'Truva Atı' yöntemi:
    // Talimatı doğrudan kullanıcının mesajının üstüne ekliyoruz.
    const prompt = `${SYSTEM_PROMPT}\n\nKullanıcı sorusu: ${lastUserMsg}`;

    const result = await model.generateContent(prompt);
    const reply = result.response.text().trim();

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("Hata:", error);
    // Hata 429 (Limit) olursa kullanıcıya bu mesaj gidecek
    return NextResponse.json({
      reply:
        "Şu an CampusBite mutfağı biraz yoğun (Limit hatası). Lütfen 30 saniye sonra tekrar dene, senin için harika tariflerim var! 🌿",
    });
  }
}
