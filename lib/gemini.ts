import { GoogleGenerativeAI } from "@google/generative-ai";

const geminiApiKey =
  process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
const geminiClient = geminiApiKey
  ? new GoogleGenerativeAI(geminiApiKey.trim())
  : null;

/** AI sürdürülebilirlik analizi — panel + ürün kartları için ortak şema */
export type SustainabilityAnalysis = {
  text: string;
  impact_score: number;
  water_liters: number;
  co2_grams: number;
  green_score: number;
  daily_tip: string;
};

/** Geriye uyumluluk */
export type GeminiProductComment = Pick<
  SustainabilityAnalysis,
  "text" | "impact_score"
>;

const DEFAULT_ANALYSIS: SustainabilityAnalysis = {
  text: "Lezzetiyle dikkat çekiyor, kampüs gününe enerji katan güzel bir seçim.",
  impact_score: 50,
  water_liters: 2.1,
  co2_grams: 220,
  green_score: 50,
  daily_tip:
    "Bugün mevsim ürünlerini ve yerel üreticileri tercih etmek hem lezzeti hem gezegeni destekler.",
};

function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 50;
  return Math.min(100, Math.max(0, Math.round(n)));
}

function clampPositive(n: unknown, fallback: number): number {
  const x = Number(n);
  if (!Number.isFinite(x) || x < 0) return fallback;
  return x;
}

function normalizeAnalysis(
  raw: Partial<Record<string, unknown>>
): SustainabilityAnalysis {
  const text =
    typeof raw.text === "string" && raw.text.trim()
      ? raw.text.trim()
      : DEFAULT_ANALYSIS.text;
  const daily_tip =
    typeof raw.daily_tip === "string" && raw.daily_tip.trim()
      ? raw.daily_tip.trim()
      : DEFAULT_ANALYSIS.daily_tip;

  const impact_score = clampScore(Number(raw.impact_score));
  const green_score = clampScore(
    Number(raw.green_score !== undefined ? raw.green_score : raw.impact_score)
  );

  return {
    text,
    impact_score,
    water_liters: clampPositive(raw.water_liters, DEFAULT_ANALYSIS.water_liters),
    co2_grams: clampPositive(raw.co2_grams, DEFAULT_ANALYSIS.co2_grams),
    green_score,
    daily_tip,
  };
}

export async function createSandwichComment(
  name: string,
  category: string,
  variationHint: string,
  productId: string
): Promise<SustainabilityAnalysis> {
  if (!geminiClient) {
    return { ...DEFAULT_ANALYSIS };
  }

  try {
    const model = geminiClient.getGenerativeModel({
      model: "gemini-1.5-flash-latest",
      systemInstruction:
        "Sen bir Sürdürülebilirlik Gurmesisin: yemekleri hem lezzet hem çevre gözlüğüyle değerlendirirsin; tonun sıcak ve esprili olmalı. Sayılar tahmini ve tutarlı olsun.",
    });

    const idLine =
      productId.trim().length > 0 ? `Ürün ID: ${productId.trim()}\n` : "";
    const prompt = `${idLine}Yemek adı: ${name}
Kategori: ${category}
Varyasyon ipucu (tekrar önlemek için): ${variationHint}

Görev: Bu tabak için sürdürülebilirlik analizi üret. Yanıtın YALNIZCA geçerli bir JSON nesnesi olsun, başka metin veya markdown kullanma.

Şema:
{
  "text": "string — tek paragraf, Türkçe, esprili gurme yorumu (lezzet + çevre)",
  "impact_score": integer 0-100 — genel sürdürülebilirlik etki puanı,
  "water_liters": number — tahmini su ayak izi / tasarruf ile ilgili anlamlı litre (ör. 0.4 ile 8 arası ondalıklı olabilir),
  "co2_grams": number — tahmini CO₂ eşdeğeri gram cinsinden pozitif tam veya ondalıklı,
  "green_score": integer 0-100 — yeşil skor (etki ile uyumlu ama bağımsız değerlendirilebilir),
  "daily_tip": "string — tek kısa cümle, Türkçe, günün sürdürülebilirlik tavsiyesi (bu ürüne hafif bağlı)"
}`;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.85,
        responseMimeType: "application/json",
      },
    });

    const rawText = result.response.text().trim();
    const parsed = JSON.parse(rawText) as Record<string, unknown>;
    return normalizeAnalysis(parsed);
  } catch (error) {
    console.error("Gemini Hatası:", error);
    return { ...DEFAULT_ANALYSIS };
  }
}

export async function createImpactComment(
  orderCount: number,
  co2Kg: number,
  foodKg: number
): Promise<string> {
  if (!geminiClient) {
    return "Bu etki, kampüs genelinde daha temiz hava ve daha az israf anlamına geliyor.";
  }

  try {
    const model = geminiClient.getGenerativeModel({
      model: "gemini-1.5-flash-latest",
    });
    const prompt = `Aşağıdaki etki raporunu Türkçe, etkileyici ve tek cümleyle yorumla.
Kurallar:
- 12 ile 18 kelime arası olsun.
- Somut benzetme kullan (ağaç, hava, tabak gibi).
- Yalnızca yorum cümlesini dön.
Veriler:
- Toplam sipariş: ${orderCount}
- Önlenen karbon salınımı: ${co2Kg} kg CO₂
- Kurtarılan gıda: ${foodKg} kg`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    return (
      text ||
      "Bu etki, kampüste her gün daha temiz hava ve daha az israf demek."
    );
  } catch (error) {
    console.error("Gemini etki yorumu hatası:", error);
    return "Bu kadar tasarruf, kampüste daha temiz nefes ve daha çok kurtarılan tabak demek.";
  }
}
