import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const noStore = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
} as const;

// API Key kontrolü
const geminiApiKey = process.env.GOOGLE_AI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

const SYSTEM_PROMPT = `Sen CampusBite uygulamasının 'Eco-Assistant'ısın. Üniversite öğrencilerine hitap ediyorsun. 
Artan yemekler için yaratıcı tarifler ver ve sürdürülebilirlik tavsiyeleri sun. 
Cevapların kısa, samimi ve motive edici olsun. Emoji kullanmayı unutma! 🌿`;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawMessages = Array.isArray(body?.messages) ? body.messages : [];
    
    // Mesajları Gemini formatına çevir (User/Model)
    const history = rawMessages.slice(0, -1).map((m: any) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.text || "" }],
    }));
    const lastUserMsg = rawMessages[rawMessages.length - 1]?.text || "";

    if (!geminiApiKey) throw new Error("API Anahtarı eksik!");

    // 2026 Standartlarında Bağlantı (v1beta en esnek sürümdür)
    const genAI = new GoogleGenerativeAI(geminiApiKey.trim());
    const model = genAI.getGenerativeModel(
      { 
        model: "gemini-3-flash", // 2026'nın en hızlı ve uyumlu modeli
        systemInstruction: SYSTEM_PROMPT 
      },
      { apiVersion: "v1beta" }
    );

    const chat = model.startChat({ history });
    const result = await chat.sendMessage(lastUserMsg);
    const reply = result.response.text();

    return NextResponse.json({ reply }, { headers: noStore });

  } catch (error: any) {
    console.error("EcoChat Hatası:", error);
    return NextResponse.json(
      { reply: `Sistem güncellemesi yapılıyor: ${error.message}. Tekrar denersen sevinirim! 🌿` },
      { headers: noStore }
    );
  }
}