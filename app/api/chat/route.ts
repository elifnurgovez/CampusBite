import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Vercel'deki GEMINI_API_KEY ismini de buraya ekledik ki anahtarı bulabilsin.
const geminiApiKey =
  process.env.GEMINI_API_KEY || 
  process.env.GOOGLE_AI_API_KEY || 
  process.env.NEXT_PUBLIC_GEMINI_API_KEY;

const SYSTEM_PROMPT = `Sen CampusBite Eco-Assistant'ısın. Üniversite öğrencilerine artan yemekler için yaratıcı tarifler ver. Cevapların kısa, samimi ve bol emojili olsun. 🌿🥪`;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const messages = Array.isArray(body?.messages) ? body.messages : [];
    const lastUserMsg =
      messages.length > 0 ? messages[messages.length - 1]?.text || "Selam!" : "Selam!";

    if (!geminiApiKey?.trim()) {
        // Eğer anahtar yoksa artık limit hatası değil, gerçek sorunu söyleyecek
        return NextResponse.json({ reply: "Hata: API Anahtarı bulunamadı! Vercel ayarlarını kontrol et." }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(geminiApiKey.trim());
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `${SYSTEM_PROMPT}\n\nKullanıcı sorusu: ${lastUserMsg}`;

    const result = await model.generateContent(prompt);
    const reply = result.response.text().trim();

    return NextResponse.json({ reply });
  } catch (error: any) {
    console.error("Gerçek Hata Detayı:", error);
    
    // Eğer hata gerçekten 429 (Limit) ise senin mesajını göstersin
    if (error?.status === 429 || error?.message?.includes("429")) {
        return NextResponse.json({
            reply: "Şu an CampusBite mutfağı biraz yoğun (Limit hatası). Lütfen 30 saniye sonra tekrar dene! 🌿",
          });
    }

    // Başka bir hataysa bize ne olduğunu söylesin ki körü körüne limit sanmayalım
    return NextResponse.json({
      reply: `Sistemsel bir hata oluştu: ${error.message}`,
    });
  }
}