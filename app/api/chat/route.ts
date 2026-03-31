import { GoogleGenerativeAI } from "@google/generative-ai";
import type { RequestOptions } from "@google/generative-ai";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Vercel'deki GEMINI_API_KEY ismini de buraya ekledik ki anahtarı bulabilsin.
const geminiApiKey =
  process.env.GOOGLE_AI_API_KEY || 
  process.env.GEMINI_API_KEY || 
  process.env.NEXT_PUBLIC_GEMINI_API_KEY;

const SYSTEM_PROMPT = `Sen CampusBite Eco-Assistant'ısın. Üniversite öğrencilerine artan yemekler için yaratıcı tarifler ver. Cevapların kısa, samimi ve bol emojili olsun. 🌿🥪`;
const GEMINI_REQUEST_OPTIONS: RequestOptions = { apiVersion: "v1" };

function buildQuotaFallbackReply(userText: string): string {
  const t = userText.toLowerCase();
  if (t.includes("sandvi") || t.includes("tost")) {
    return "Eldeki sandviçi minik küpler yap, yoğurt + baharatla soğuk kaseye dönüştür; üstüne zeytinyağı gezdir. 🥪🌿";
  }
  if (t.includes("pilav") || t.includes("makarna")) {
    return "Kalan pilav/makarnayı sebzeyle tavada çevir, limon ve baharat ekleyip pratik bir bowl yapabilirsin. 🍋🥗";
  }
  if (t.includes("tatlı") || t.includes("ekmek")) {
    return "Bayat ekmeği tarçınlı fırın cipsine çevirip yoğurt-meyveyle hafif bir tatlı tabak hazırlayabilirsin. 🍞✨";
  }
  return "Şu an AI kotası dolu ama devam edebiliriz: kalan yemeği sebze + sosla yeni bir bowl'a çevir, tek tavada toparla. 🌿";
}

export async function POST(request: Request) {
  let lastUserMsg = "Selam!";
  try {
    const body = await request.json();
    const messages = Array.isArray(body?.messages) ? body.messages : [];
    lastUserMsg =
      messages.length > 0 ? messages[messages.length - 1]?.text || "Selam!" : "Selam!";

    if (!geminiApiKey?.trim()) {
        // Eğer anahtar yoksa artık limit hatası değil, gerçek sorunu söyleyecek
        return NextResponse.json({ reply: "Hata: API Anahtarı bulunamadı! Vercel ayarlarını kontrol et." }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(geminiApiKey.trim());
    const model = genAI.getGenerativeModel(
      { model: "gemini-2.0-flash" },
      GEMINI_REQUEST_OPTIONS
    );

    const prompt = `${SYSTEM_PROMPT}\n\nKullanıcı sorusu: ${lastUserMsg}`;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });
    const reply = result.response.text().trim();

    return NextResponse.json({ reply });
  } catch (error: any) {
    console.error("Gerçek Hata Detayı:", error);
    const msg = String(error?.message ?? "");
    if (error?.status === 429 || msg.includes("429") || msg.toLowerCase().includes("quota")) {
      return NextResponse.json({ reply: buildQuotaFallbackReply(lastUserMsg) });
    }
    return NextResponse.json({ reply: "GERÇEK HATA: " + error.message });
  }
}