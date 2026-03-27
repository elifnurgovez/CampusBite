import { GoogleGenerativeAI } from "@google/generative-ai";

const geminiApiKey = process.env.GOOGLE_AI_API_KEY?.trim();

const geminiClient = geminiApiKey
  ? new GoogleGenerativeAI(geminiApiKey)
  : null;

export type GeminiProductComment = {
  text: string;
  impact_score: number;
};

const FALLBACK_COMMENT: GeminiProductComment = {
  text: "Lezzetiyle dikkat cekiyor, kampus gunune enerji katan guzel bir secim.",
  impact_score: 50,
};

function clampImpact(n: number): number {
  if (!Number.isFinite(n)) return 50;
  return Math.min(100, Math.max(0, Math.round(n)));
}

function parseProductCommentJson(raw: string): GeminiProductComment | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed) as {
      text?: unknown;
      impact_score?: unknown;
    };
    const text =
      typeof parsed.text === "string" && parsed.text.trim()
        ? parsed.text.trim()
        : null;
    const impact_score =
      typeof parsed.impact_score === "number"
        ? clampImpact(parsed.impact_score)
        : 50;
    if (!text) return null;
    return { text, impact_score };
  } catch {
    return null;
  }
}

export async function createSandwichComment(
  name: string,
  category: string,
  variationHint: string,
  productId: string
): Promise<GeminiProductComment> {
  if (!geminiClient) {
    return { ...FALLBACK_COMMENT };
  }

  try {
    const model = geminiClient.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction: `Sen bir Sürdürülebilirlik Gurmesisin: yemekleri hem lezzet hem çevre/footprint gözlüğüyle yorumlarsın; tonun sıcak, esprili ve bilgilendiricidir.`,
    });
    const timestamp = new Date().toISOString();
    const idLine =
      productId.trim().length > 0 ? `Ürün ID: ${productId.trim()}\n` : "";
    const prompt = `${idLine}Şu anki zaman: ${timestamp}.

Görev: Aşağıdaki yemeğe özel TEK bir Türkçe cümle yaz; bu cümlede mutlaka (1) yemeğin içeriğine veya adına gönderme yap, (2) yanına esprili, kısa bir çevreci gerçek veya benzetme ekle (su, atık, karbon, biyoçeşitlilik, yerel üretim vb.). Her çağrıda cümle yapısını ve kelimeleri öncekilerden farklı tut; tekrar etme.
Yanıtın YALNIZCA geçerli bir JSON nesnesi olsun, başka metin veya markdown kullanma.
Şema: {"text":"string","impact_score":number}
- text: tek cümle, yaklaşık 18–32 kelime; mizahi ama saygılı.
- impact_score: 0–100 arası tamsayı; bu tabağın sürdürülebilirlik “etki” skoru (subjektif, tutarlı olsun).

Yemek adı: ${name}
Kategori: ${category}
Benzersizlik ipucu (tekrar etme): ${variationHint}`;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.95,
        topP: 0.95,
        responseMimeType: "application/json",
      },
    });
    const raw = result.response.text().trim();
    const parsed = parseProductCommentJson(raw);
    if (parsed) return parsed;
    return {
      text:
        raw ||
        "Taze ve doyurucu bir secim, kampuste gununu guzellestirecek bir lezzet.",
      impact_score: 50,
    };
  } catch (error) {
    console.error("Gemini yorum olusturma hatasi:", error);
    return {
      text: "Kokusu mest ediyor, her lokmasi mutluluk veren nefis bir kampus lezzeti.",
      impact_score: 50,
    };
  }
}

export async function createImpactComment(
  orderCount: number,
  co2Kg: number,
  foodKg: number
): Promise<string> {
  if (!geminiClient) {
    return "Bu etki, kampus genelinde daha temiz hava ve daha az israf anlamina geliyor.";
  }

  try {
    const model = geminiClient.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `Asagidaki etki raporunu Turkce, etkileyici ve tek cumleyle yorumla.
Kurallar:
- 12 ile 18 kelime arasi olsun.
- Somut benzetme kullan (agac, hava, tabak gibi).
- Yalnizca yorum cumlesini don.
Veriler:
- Toplam siparis: ${orderCount}
- Onlenen karbon salinimi: ${co2Kg} kg CO2
- Kurtarilan gida: ${foodKg} kg`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    return text || "Bu etki, kampuste her gun daha temiz hava ve daha az israf demek.";
  } catch (error) {
    console.error("Gemini etki yorumu hatasi:", error);
    return "Bu kadar tasarruf, kampuste daha temiz nefes ve daha cok kurtarilan tabak demek.";
  }
}
