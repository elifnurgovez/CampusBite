import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const geminiApiKey = process.env.GOOGLE_AI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

export async function POST(request: Request) {
  try {
    const { messages } = await request.json();
    const lastUserMessage = messages[messages.length - 1]?.text || "";

    if (!geminiApiKey) throw new Error("API_KEY_MISSING");

    const genAI = new GoogleGenerativeAI(geminiApiKey);
    // En stabil model ve versiyon:
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Talimatı doğrudan mesajın içine gömüyoruz (Böylece sistem hata veremez)
    const prompt = `Sen CampusBite Eco-Assistant'ısın. Kısa, samimi ve emojili cevap ver. 
    Kullanıcı sorusu: ${lastUserMessage}`;

    const result = await model.generateContent(prompt);
    const reply = result.response.text();

    return NextResponse.json({ reply });

  } catch (error: any) {
    console.error("Hata:", error);
    return NextResponse.json({ 
      reply: `Bağlantı başarılı ama bir sorun var: ${error.message}. 🌿` 
    });
  }
}