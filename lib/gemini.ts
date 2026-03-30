import { GoogleGenerativeAI } from "@google/generative-ai";
import type { RequestOptions } from "@google/generative-ai";

const geminiApiKey =
  process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
const geminiClient = geminiApiKey
  ? new GoogleGenerativeAI(geminiApiKey.trim())
  : null;

const GEMINI_REQUEST_OPTIONS: RequestOptions = { apiVersion: "v1" };
const SUSTAINABILITY_MODEL = "gemini-2.0-flash";

/** Etki puanına göre eksik alanları doldur (sabit 2.1 / 220 yerine) */
export function estimateWaterFromImpact(impact: number): number {
  const i = Math.min(100, Math.max(0, impact));
  return Math.round((0.3 + (i / 100) * 7.7) * 10) / 10;
}

export function estimateCo2FromImpact(impact: number): number {
  const i = Math.min(100, Math.max(0, impact));
  return Math.round(50 + (i / 100) * 750);
}

/** AI sürdürülebilirlik analizi — panel + ürün kartları için ortak şema */
export type SustainabilityAnalysis = {
  text: string;
  impact_score: number;
  water_liters: number;
  co2_avoided: number;
  green_score: number;
  daily_tip: string;
};

/** Geriye uyumluluk */
export type GeminiProductComment = Pick<
  SustainabilityAnalysis,
  "text" | "impact_score"
>;

const DEFAULT_IMPACT = 50;

/** API yok / tamamen başarısız — rakamlar etki puanından türetilir (sabit 2.1/220 yok) */
export const DEFAULT_FALLBACK_ANALYSIS: SustainabilityAnalysis = {
  text: "Lezzetiyle dikkat çekiyor, kampüs gününe enerji katan güzel bir seçim.",
  impact_score: DEFAULT_IMPACT,
  water_liters: estimateWaterFromImpact(DEFAULT_IMPACT),
  co2_avoided: estimateCo2FromImpact(DEFAULT_IMPACT),
  green_score: DEFAULT_IMPACT,
  daily_tip:
    "Bugün mevsim ürünlerini ve yerel üreticileri tercih etmek hem lezzeti hem gezegeni destekler.",
};

function clampScore(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_IMPACT;
  return Math.min(100, Math.max(0, Math.round(n)));
}

function clampPositive(n: unknown, fallback: number): number {
  const x = Number(n);
  if (!Number.isFinite(x) || x < 0) return fallback;
  return x;
}

function extractJsonObject(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const block = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (block?.[1]) {
      try {
        return JSON.parse(block[1].trim()) as Record<string, unknown>;
      } catch {
        /* continue */
      }
    }
    const brace = trimmed.indexOf("{");
    const last = trimmed.lastIndexOf("}");
    if (brace >= 0 && last > brace) {
      try {
        return JSON.parse(trimmed.slice(brace, last + 1)) as Record<
          string,
          unknown
        >;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function normalizeAnalysis(
  raw: Partial<Record<string, unknown>>
): SustainabilityAnalysis {
  const text =
    typeof raw.text === "string" && raw.text.trim()
      ? raw.text.trim()
      : DEFAULT_FALLBACK_ANALYSIS.text;
  const daily_tip =
    typeof raw.daily_tip === "string" && raw.daily_tip.trim()
      ? raw.daily_tip.trim()
      : DEFAULT_FALLBACK_ANALYSIS.daily_tip;

  const impact_score = clampScore(Number(raw.impact_score));
  const green_score = clampScore(
    Number(raw.green_score !== undefined ? raw.green_score : raw.impact_score)
  );

  const waterRaw = raw.water_liters ?? raw.water_saving;
  const co2Raw = raw.co2_avoided ?? raw.co2_grams;

  return {
    text,
    impact_score,
    water_liters: clampPositive(
      waterRaw,
      estimateWaterFromImpact(impact_score)
    ),
    co2_avoided: clampPositive(co2Raw, estimateCo2FromImpact(impact_score)),
    green_score,
    daily_tip,
  };
}

/**
 * Ürün adı + kategoriye göre Gemini ile çevresel tahminler (impact, su, CO₂, yeşil skor, günün tavsiyesi).
 * systemInstruction kullanılmaz (v1 uyumu); talimat tamamen prompt içinde.
 */
export async function createSandwichComment(
  name: string,
  category: string,
  variationHint: string,
  productId: string
): Promise<SustainabilityAnalysis> {
  if (!geminiClient) {
    return { ...DEFAULT_FALLBACK_ANALYSIS };
  }

  try {
    const model = geminiClient.getGenerativeModel(
      { model: SUSTAINABILITY_MODEL },
      GEMINI_REQUEST_OPTIONS
    );

    const idLine =
      productId.trim().length > 0 ? `Ürün ID: ${productId.trim()}\n` : "";
    const prompt = `Sen bir Sürdürülebilirlik Gurmesisin: yemekleri hem lezzet hem çevre gözlüğüyle değerlendirirsin; tonun sıcak ve esprili olmalı. Sayılar ürüne göre tutarlı tahminler olsun.

${idLine}Yemek adı: ${name}
Kategori: ${category}
Varyasyon ipucu (tekrar önlemek için): ${variationHint}

Görev: Bu tabak için sürdürülebilirlik analizi üret. Yanıtın YALNIZCA geçerli bir JSON nesnesi olsun, başka metin veya markdown kullanma.

Şema (alan adları birebir kullan):
{
  "text": "string — tek paragraf, Türkçe, esprili gurme yorumu (lezzet + çevre)",
  "impact_score": integer 0-100,
  "water_liters": number — tahmini su ile ilgili anlamlı litre (ör. 0.3–8),
  "co2_avoided": number — tahmini CO₂ eşdeğeri gram (ör. 50–900),
  "green_score": integer 0-100,
  "daily_tip": "string — tek kısa cümle, Türkçe, günün sürdürülebilirlik tavsiyesi"
}

İsteğe bağlı eş anlamlı alanlar da kabul edilir: "water_saving" (litre), "co2_grams" (gram); bunlar water_liters / co2_avoided ile aynı anlamdadır.`;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.85,
        responseMimeType: "application/json",
      },
    });

    const rawText = result.response.text().trim();
    const parsed = extractJsonObject(rawText);
    if (!parsed) {
      console.error("Gemini JSON ayrıştırılamadı:", rawText.slice(0, 500));
      return { ...DEFAULT_FALLBACK_ANALYSIS };
    }
    return normalizeAnalysis(parsed);
  } catch (error) {
    console.error("Gemini Hatası:", error);
    return { ...DEFAULT_FALLBACK_ANALYSIS };
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
    const model = geminiClient.getGenerativeModel(
      { model: SUSTAINABILITY_MODEL },
      GEMINI_REQUEST_OPTIONS
    );
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
