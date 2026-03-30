"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type MouseEvent,
} from "react";

import {
  estimateCo2FromImpact,
  estimateWaterFromImpact,
} from "@/lib/gemini";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type ProductRow = {
  id: string;
  name: string;
  priceLabel: string;
  category: string;
  imageUrl: string;
  ingredients: string;
  caloriesKcal: number;
  proteinG: number;
  /** Ürün id’sine göre tutarlı, kartlar arası farklı puan */
  rating: number;
  deliveryWindow: string;
  savingsCo2Kg: number;
  badges: { key: string; label: string; className: string }[];
};

type PastelKind = "vegan" | "meat" | "sweet" | "bakery" | "default";

type ManualSustainabilityPanel = {
  impact_score: number;
  text: string;
  water_liters: number;
  co2_avoided: number;
  green_score: number;
  daily_tip: string;
};

type LeafParticle = {
  id: number;
  left: number;
  top: number;
  tx: number;
  ty: number;
  rot: number;
  delay: number;
};

const FOOD_IMAGES: Record<PastelKind, string> = {
  vegan:
    "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80&auto=format&fit=crop",
  meat:
    "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80&auto=format&fit=crop",
  sweet:
    "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=800&q=80&auto=format&fit=crop",
  /** Poğaça, börek, fırın — ahşap masada tuzlu hamur işi tabağı (Unsplash: Ömer Taha Çetin) */
  bakery:
    "https://images.unsplash.com/photo-1733252210994-51b09b37dcd4?w=800&q=80&auto=format&fit=crop",
  default:
    "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80&auto=format&fit=crop",
};

/** İsim bazlı görsel düzeltmesi (Supabase’de yanlış/eksik URL olsa bile). */
function imageOverrideByName(name: string): string | null {
  const n = name.toLowerCase();
  if (
    /poğaça|pogaca|poaca|börek|borek|açma|acma|çörek|çanta.*(poğaça|pogaca)|karışık.*poğaça|karisik.*pogaca/.test(
      n
    )
  ) {
    return FOOD_IMAGES.bakery;
  }
  return null;
}

function getPastelKind(category: string, name: string): PastelKind {
  const c = `${category} ${name}`.toLowerCase();
  if (/vegan|vej|bitki|salata|yeşil|green|veggie|humus|falafel|bowl/.test(c)) {
    return "vegan";
  }
  if (
    /poğaça|pogaca|poaca|börek|borek|açma|acma|çörek|simit|fırın|firin|pastane|bakery|pastry|hamur/.test(
      c
    )
  ) {
    return "bakery";
  }
  if (
    /tatlı|dessert|kek|kurabiye|pasta|şeker|sweet|dondurma|sufle|waffle|brownie/.test(
      c
    )
  ) {
    return "sweet";
  }
  if (
    /tavuk|köfte|et|döner|kebap|balık|sucuk|şark|burger|meat|chicken|beef|kıyma|sosis|lahmacun|bbq|sandviç/.test(
      c
    )
  ) {
    return "meat";
  }
  return "default";
}

function defaultDetails(kind: PastelKind): {
  ingredients: string;
  caloriesKcal: number;
  proteinG: number;
} {
  switch (kind) {
    case "vegan":
      return {
        ingredients:
          "Kinoa, Nohut, Tatlı Patates, Edamame, Avokado, Tahin Sos. Yüksek protein & lif.",
        caloriesKcal: 512,
        proteinG: 22,
      };
    case "meat":
      return {
        ingredients:
          "Izgara tavuk, köz biber, marul, domates, BBQ sos. Yüksek protein.",
        caloriesKcal: 620,
        proteinG: 28,
      };
    case "sweet":
      return {
        ingredients:
          "Çikolata, fındık, karamelize meyve. Serin servis, tatlı denge.",
        caloriesKcal: 380,
        proteinG: 8,
      };
    case "bakery":
      return {
        ingredients:
          "Taze poğaça çeşitleri, tereyağı, peynir & zeytin seçenekleri. Fırından günlük.",
        caloriesKcal: 420,
        proteinG: 12,
      };
    default:
      return {
        ingredients:
          "Taze seçilmiş malzemeler, günlük hazırlık. Kampüs kalitesi.",
        caloriesKcal: 450,
        proteinG: 18,
      };
  }
}

function stringHash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

/** Aynı DB değeri tüm satırlarda olsa bile ürün başına farklı puan (4.1–4.9). */
function stableRating(id: string): number {
  const h = stringHash(id);
  return Math.round((4.1 + (h % 80) / 100) * 10) / 10;
}

const DELIVERY_SLOTS = [
  "11:00 - 12:00",
  "11:30 - 12:30",
  "12:00 - 13:00",
  "12:15 - 13:15",
  "12:30 - 13:30",
  "13:00 - 14:00",
  "13:30 - 14:30",
  "11:45 - 12:45",
];

function deliveryWindowFromId(id: string): string {
  return DELIVERY_SLOTS[stringHash(id) % DELIVERY_SLOTS.length];
}

/** 0.25 – 0.95 kg CO₂ arası ürün bazlı tasarruf göstergesi */
function savingsCo2KgFromId(id: string): number {
  const h = stringHash(id);
  const hundredths = 25 + (h % 71);
  return hundredths / 100;
}

function buildBadges(
  kind: PastelKind,
  proteinG: number,
  item: Record<string, unknown>,
  index: number
): { key: string; label: string; className: string }[] {
  const tags = String(item.tags ?? item.dietary ?? "").toLowerCase();
  const glutenFree =
    item.gluten_free === true ||
    /gluten|glutensiz|gf\b/.test(tags) ||
    kind === "vegan";
  const highProtein =
    proteinG >= 20 || /protein|yüksek/.test(tags) || kind === "meat";

  const out: { key: string; label: string; className: string }[] = [];
  if (kind === "vegan") {
    out.push({
      key: "vegan",
      label: "Vegan",
      className:
        "rounded-full border border-emerald-300/80 bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-[#1a2e35] shadow-sm",
    });
  }
  if (glutenFree) {
    out.push({
      key: "gf",
      label: "Glutensiz",
      className:
        "rounded-full border border-amber-300/80 bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-[#1a2e35] shadow-sm",
    });
  }
  if (index % 4 === 0) {
    out.push({
      key: "pop",
      label: "Popüler",
      className:
        "rounded-full border border-rose-300/90 bg-rose-100 px-2.5 py-1 text-[10px] font-bold text-[#1a2e35] shadow-sm",
    });
  }
  if (kind === "bakery") {
    out.push({
      key: "bakery",
      label: "Fırın",
      className:
        "rounded-full border border-amber-300/80 bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-[#1a2e35] shadow-sm",
    });
  }
  if (highProtein) {
    out.push({
      key: "hp",
      label: "Yüksek Protein",
      className:
        "rounded-full border border-orange-300/80 bg-orange-100 px-2.5 py-1 text-[10px] font-bold text-[#1a2e35] shadow-sm",
    });
  }
  if (out.length === 0) {
    out.push({
      key: "fresh",
      label: "Taze",
      className:
        "rounded-full border border-teal-300/80 bg-teal-100 px-2.5 py-1 text-[10px] font-bold text-[#1a2e35] shadow-sm",
    });
  }
  return out;
}

function mapProduct(
  item: Record<string, unknown>,
  index: number
): ProductRow {
  const name = String(item.name ?? item.title ?? "Sürpriz Paket");
  const priceRaw = item.price;
  const priceStr =
    priceRaw != null && String(priceRaw).trim() !== ""
      ? String(priceRaw)
      : "—";
  const rawId = item.id;
  const idStr = rawId != null ? String(rawId).trim() : "";
  const hasRealId =
    idStr !== "" && idStr !== "undefined" && idStr !== "null";

  const id = hasRealId ? idStr : `virtual:${name}::${priceStr}::${index}`;
  const category = String(item.category ?? item.type ?? "");
  const kind = getPastelKind(category, name);
  const defaults = defaultDetails(kind);

  const rawImg =
    typeof item.image_url === "string"
      ? item.image_url.trim()
      : typeof item.image === "string"
        ? item.image.trim()
        : "";
  const nameOverride = imageOverrideByName(name);
  const imageUrl =
    nameOverride ?? (rawImg || FOOD_IMAGES[kind]);

  const ingredients = String(
    item.ingredients ?? item.description ?? defaults.ingredients
  );
  const caloriesKcal = Number(
    item.calories_kcal ?? item.calories ?? defaults.caloriesKcal
  );
  const proteinG = Number(
    item.protein_g ?? item.protein ?? defaults.proteinG
  );

  const deliveryRaw =
    typeof item.delivery_window === "string"
      ? item.delivery_window.trim()
      : typeof item.deliveryWindow === "string"
        ? item.deliveryWindow.trim()
        : "";
  const deliveryWindow = deliveryRaw || deliveryWindowFromId(id);

  const savingsRaw = item.savings_co2_kg ?? item.savings_co2;
  const savingsParsed = Number(savingsRaw);
  const savingsCo2Kg =
    Number.isFinite(savingsParsed) && savingsRaw != null && savingsRaw !== ""
      ? savingsParsed
      : savingsCo2KgFromId(id);

  return {
    id,
    name,
    priceLabel: item.price != null ? `${item.price} TL` : "—",
    category,
    imageUrl,
    ingredients,
    caloriesKcal: Number.isFinite(caloriesKcal) ? caloriesKcal : defaults.caloriesKcal,
    proteinG: Number.isFinite(proteinG) ? proteinG : defaults.proteinG,
    rating: stableRating(id),
    deliveryWindow,
    savingsCo2Kg,
    badges: buildBadges(kind, proteinG, item, index),
  };
}

const pastelCard: Record<
  PastelKind,
  { bg: string; border: string; borderTop: string }
> = {
  vegan: {
    bg: "bg-emerald-50",
    border: "border-emerald-200/90",
    borderTop: "border-emerald-200/90",
  },
  meat: {
    bg: "bg-orange-50",
    border: "border-orange-200/90",
    borderTop: "border-orange-200/90",
  },
  sweet: {
    bg: "bg-violet-50",
    border: "border-violet-200/80",
    borderTop: "border-violet-200/80",
  },
  bakery: {
    bg: "bg-amber-50",
    border: "border-amber-200/90",
    borderTop: "border-amber-200/90",
  },
  default: {
    bg: "bg-sky-50",
    border: "border-sky-200/80",
    borderTop: "border-sky-200/80",
  },
};

function evolutionProgress(orderCount: number): number {
  const n = Math.max(0, Math.floor(Number(orderCount) || 0));
  if (n <= 0) return 0;
  if (n < 5) return (n / 5) * 50;
  if (n < 10) return 50 + ((n - 5) / 5) * 50;
  return 100;
}

/** Tek kaynak: sayıya zorlanmış sipariş sayısı (string/undefined hatalarını önler). */
function normalizeOrderCount(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

function FlameIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        d="M12 2c0 4-4 6-4 10a4 4 0 108 0c0-4-4-6-4-10z"
        fill="currentColor"
        opacity="0.9"
      />
    </svg>
  );
}

function DumbbellIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <rect x="2" y="8" width="4" height="8" rx="1" />
      <rect x="18" y="8" width="4" height="8" rx="1" />
      <rect x="6" y="10" width="12" height="4" rx="1" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M12 7v5l3 2"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LeafIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M12 3c-4 4-6 8-6 12a6 6 0 1012 0c0-4-2-8-6-12z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M12 9v10"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function DropletIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M12 3.5c-3 4.2-6 8.1-6 12.2a6 6 0 1012 0c0-4.1-3-7.9-6-12.2z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TreeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M12 22V14M8 14h8M12 14c-2-3-4-5.5-4-8a4 4 0 118 0c0 2.5-2 5-4 8z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function formatWaterLiters(n: number): string {
  return `${n.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} L`;
}

function formatCo2Grams(g: number): string {
  if (g >= 1000) {
    return `${(g / 1000).toLocaleString("tr-TR", { maximumFractionDigits: 2 })} kg`;
  }
  return `${Math.round(g).toLocaleString("tr-TR")} g`;
}

export default function Home() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [orderCount, setOrderCount] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [isBootLoading, setIsBootLoading] = useState(true);
  const [orderingId, setOrderingId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [plantModalOpen, setPlantModalOpen] = useState(false);
  const [leafParticles, setLeafParticles] = useState<LeafParticle[]>([]);
  const [geminiComments, setGeminiComments] = useState<Record<string, string>>(
    {}
  );
  const [geminiImpactScores, setGeminiImpactScores] = useState<
    Record<string, number>
  >({});
  const [manualProductName, setManualProductName] = useState("");
  const [manualPanel, setManualPanel] = useState<ManualSustainabilityPanel | null>(
    null
  );
  const [manualAnalyzing, setManualAnalyzing] = useState(false);
  const [manualError, setManualError] = useState("");

  /** Ürün listesi referansı yerine içerik imzası — useEffect bağımlılık dizisini sabit uzunlukta tutar. */
  const productsFetchKey = useMemo(
    () =>
      products
        .map((p) => `${p.id}\u001f${p.name}\u001f${p.category}`)
        .join("\u001e"),
    [products]
  );

  const orderCountN = normalizeOrderCount(orderCount);

  const carbonKg = useMemo(
    () => (orderCountN * 0.8).toFixed(1),
    [orderCountN]
  );

  /**
   * Kesin evrim: 0–4 filiz (🌱), 5–9 gelişen bitki (🌿), 10+ çınar (🌳).
   * Not: 🫘 bazı işletim sistemlerinde görünmez; 0–4 hep 🌱 ile tutarlı sunum.
   */
  const yesilcan = useMemo(() => {
    const c = orderCountN;
    if (c >= 0 && c <= 4) {
      return {
        emoji: "🌱",
        description:
          c === 0
            ? "Tohum filizlendi — yolun başındasın, büyüyeceğiz!"
            : "Küçük filiz: Yolun başındasın, büyüyeceğiz!",
        progress: evolutionProgress(c),
      };
    }
    if (c >= 5 && c <= 9) {
      return {
        emoji: "🌿",
        description: "Büyüyen fidan — köklerin kampüsü sardı!",
        progress: evolutionProgress(c),
      };
    }
    return {
      emoji: "🌳",
      description: "Heybetli Koca Çınar — kampüsün koruyucu çınarı sensin!",
      progress: 100,
    };
  }, [orderCountN]);

  /** Önce fidan (5 sipariş), sonra koca çınar (10 sipariş). Tohum aşamasında çınara kalan adım gösterme. */
  const kocaCanarStepText = useMemo(() => {
    const c = orderCountN;
    if (c > 10) return "Zirvedesin!";
    if (c >= 10) return "Koca Çınar (🌳) kademesindesin!";
    if (c <= 4) {
      const k = Math.max(0, 5 - c);
      return `Şu an tohumdasın — Fidan (🌿) olmana sadece ${k} adım kaldı!`;
    }
    return `Koca Çınar (🌳) olmana sadece ${Math.max(0, 10 - c)} adım kaldı!`;
  }, [orderCountN]);

  /** Rütbe kartı + karşılama: sipariş kademesine göre */
  const rankLabel = useMemo(() => {
    const c = orderCountN;
    if (c >= 10) return "Koca Çınar";
    if (c >= 5) return "Gelişen Fidan";
    return "Acemi Isırık";
  }, [orderCountN]);

  const rankEmoji = useMemo(() => {
    const c = orderCountN;
    if (c >= 10) return "🌳";
    if (c >= 5) return "🌿";
    return "🌱";
  }, [orderCountN]);

  const nextSurpriseText = useMemo(() => {
    const c = orderCountN;
    if (c <= 4) {
      return "Sonraki kademe (🌿): profil rozeti + kampüs çekiliş bileti sürprizi seni bekliyor.";
    }
    if (c <= 9) {
      return "Sonraki kademe (🌳): özel indirim kodu ve Yeşilcan kutusu sürprizi seni bekliyor.";
    }
    return "Zirvedesin: her siparişte ekstra kampüs puanı ve aylık sürdürülebilirlik rozetleri açık.";
  }, [orderCountN]);

  const triggerLeafConfetti = useCallback((clientX: number, clientY: number) => {
    const base = Date.now();
    const next: LeafParticle[] = Array.from({ length: 18 }, (_, i) => ({
      id: base + i,
      left: clientX,
      top: clientY,
      tx: (Math.random() - 0.5) * 320,
      ty: -90 - Math.random() * 180,
      rot: (Math.random() - 0.5) * 220,
      delay: i * 28,
    }));
    setLeafParticles((p) => [...p, ...next]);
    window.setTimeout(() => {
      setLeafParticles((p) => p.filter((x) => !next.some((n) => n.id === x.id)));
    }, 1600);
  }, []);

  const fetchOrderCount = useCallback(async (): Promise<number> => {
    if (!isSupabaseConfigured) return 0;
    const { data, count, error } = await supabase
      .from("orders")
      .select("*", { count: "exact" });

    if (error) {
      console.error("orders count:", error.message);
      return 0;
    }
    if (typeof count === "number") return count;
    return Array.isArray(data) ? data.length : 0;
  }, []);

  const fetchProducts = useCallback(async (): Promise<ProductRow[]> => {
    if (!isSupabaseConfigured) return [];
    const { data, error } = await supabase.from("products").select("*");
    if (error || !data) {
      throw new Error(error?.message ?? "Ürünler alınamadı");
    }
    return data.map((item: Record<string, unknown>, index: number) =>
      mapProduct(item, index)
    );
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoadError("");
      setIsBootLoading(true);
      try {
        const [count, rows] = await Promise.all([
          fetchOrderCount(),
          fetchProducts(),
        ]);
        setOrderCount(normalizeOrderCount(count));
        setProducts(rows);
      } catch (e) {
        console.error(e);
        setLoadError("Veriler yüklenemedi. Bağlantını kontrol et.");
        setProducts([]);
        setOrderCount(0);
      } finally {
        setIsBootLoading(false);
      }
    };

    fetchData();
  }, [fetchOrderCount, fetchProducts]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (isBootLoading || products.length === 0) return;

      await Promise.all(
        products.map(async (item) => {
          try {
            const url = `/api/gemini-comment?id=${encodeURIComponent(item.id)}&t=${Date.now()}`;
            const res = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                id: item.id,
                name: item.name,
                category: item.category,
                variationHint: `${item.name}-${item.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
              }),
              cache: "no-store",
            });
            const data = (await res.json()) as {
              text?: string;
              comment?: string;
              impact_score?: number;
            };
            if (cancelled) return;
            const raw =
              typeof data.text === "string" && data.text.trim()
                ? data.text.trim()
                : typeof data.comment === "string"
                  ? data.comment.trim()
                  : "";
            const fallback =
              "Lezzetiyle dikkat çeken güzel bir kampüs seçeneği.";
            setGeminiComments((prev) => ({
              ...prev,
              [item.id]: raw || fallback,
            }));
            if (typeof data.impact_score === "number") {
              setGeminiImpactScores((prev) => ({
                ...prev,
                [item.id]: Math.min(
                  100,
                  Math.max(0, Math.round(data.impact_score!))
                ),
              }));
            }
          } catch (e) {
            console.error("Gemini yorum:", e);
          }
        })
      );
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- products içeriği productsFetchKey ile izleniyor
  }, [isBootLoading, productsFetchKey]);

  const handleManualAnalyze = async () => {
    const name = manualProductName.trim();
    if (!name) {
      setManualError("Lütfen bir ürün adı yazın.");
      return;
    }
    setManualError("");
    setManualAnalyzing(true);
    try {
      const kind = getPastelKind("Özel", name);
      const categoryLabel =
        kind === "vegan"
          ? "Vegan"
          : kind === "meat"
            ? "Et & sandviç"
            : kind === "sweet"
              ? "Tatlı"
              : kind === "bakery"
                ? "Fırın"
                : "Genel";
      const productId = `manual-${crypto.randomUUID()}`;
      const url = `/api/gemini-comment?id=${encodeURIComponent(productId)}&t=${Date.now()}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: productId,
          name,
          category: categoryLabel,
          variationHint: `manual-${name}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        }),
        cache: "no-store",
      });
      const data = (await res.json()) as {
        text?: string;
        comment?: string;
        impact_score?: number;
        water_liters?: number;
        water_saving?: number;
        co2_avoided?: number;
        co2_grams?: number;
        green_score?: number;
        daily_tip?: string;
      };
      const raw =
        typeof data.text === "string" && data.text.trim()
          ? data.text.trim()
          : typeof data.comment === "string"
            ? data.comment.trim()
            : "";
      const impact =
        typeof data.impact_score === "number"
          ? Math.min(100, Math.max(0, Math.round(data.impact_score)))
          : 50;
      const green =
        typeof data.green_score === "number"
          ? Math.min(100, Math.max(0, Math.round(data.green_score)))
          : impact;
      const water =
        typeof data.water_liters === "number" && Number.isFinite(data.water_liters)
          ? Math.max(0, data.water_liters)
          : typeof data.water_saving === "number" &&
              Number.isFinite(data.water_saving)
            ? Math.max(0, data.water_saving)
            : estimateWaterFromImpact(impact);
      const co2 =
        typeof data.co2_grams === "number" && Number.isFinite(data.co2_grams)
          ? Math.max(0, data.co2_grams)
          : typeof data.co2_avoided === "number" &&
              Number.isFinite(data.co2_avoided)
            ? Math.max(0, data.co2_avoided)
            : estimateCo2FromImpact(impact);
      const tip =
        typeof data.daily_tip === "string" && data.daily_tip.trim()
          ? data.daily_tip.trim()
          : "Bugün mevsim ürünlerini tercih etmek küçük ama etkili bir adımdır.";
      setManualPanel({
        impact_score: impact,
        text: raw || "Sonuç alınamadı.",
        water_liters: water,
        co2_avoided: co2,
        green_score: green,
        daily_tip: tip,
      });
    } catch (e) {
      console.error("Manuel analiz:", e);
      setManualError("Analiz sırasında bir hata oluştu. Tekrar dene.");
    } finally {
      setManualAnalyzing(false);
    }
  };

  const handleManualReset = () => {
    setManualProductName("");
    setManualPanel(null);
    setManualError("");
  };

  const handleOrder = async (product: ProductRow, e?: MouseEvent) => {
    if (!isSupabaseConfigured) return;
    setOrderingId(product.id);
    const previousCount = orderCountN;
    setOrderCount((c) => normalizeOrderCount(c) + 1);

    try {
      const { error: err1 } = await supabase.from("orders").insert({
        product_id: product.id,
      });
      if (err1) {
        const { error: err2 } = await supabase.from("orders").insert({});
        if (err2) throw err2;
      }
      if (e) {
        triggerLeafConfetti(e.clientX, e.clientY);
      }
      setToast("Paket kaydedildi!");
      window.setTimeout(() => setToast(""), 3000);
    } catch (err) {
      console.error("Sipariş:", err);
      setOrderCount(previousCount);
      setToast("İşlem başarısız. Tekrar dene.");
      window.setTimeout(() => setToast(""), 3500);
    } finally {
      setOrderingId(null);
    }
  };

  /** Sunum: tüm siparişleri sil + sayacı sıfırla */
  const handleResetOrders = async () => {
    if (!isSupabaseConfigured) return;
    const { error } = await supabase.from("orders").delete().neq("id", 0);
    if (error) {
      const { error: err2 } = await supabase
        .from("orders")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");
      if (err2) {
        console.error("Sıfırlama:", err2.message);
        setToast("Sıfırlanamadı (RLS veya id tipi).");
        window.setTimeout(() => setToast(""), 4000);
        return;
      }
    }
    const fresh = await fetchOrderCount();
    setOrderCount(normalizeOrderCount(fresh));
    setToast("Siparişler sıfırlandı.");
    window.setTimeout(() => setToast(""), 2500);
  };

  const statCardWhite =
    "flex flex-col justify-center rounded-2xl border border-emerald-100/70 bg-white px-5 py-5 shadow-md ring-1 ring-emerald-200/40";

  return (
    <main className="min-h-screen bg-gradient-to-b from-white via-sky-50/50 to-emerald-50/40 font-sans antialiased">
      <div className="mx-auto max-w-6xl space-y-10 px-4 py-8 md:space-y-12 md:px-6 md:py-12">
        {isBootLoading ? (
          <section className="w-full overflow-hidden rounded-[40px] bg-[#f4fbf7] p-8 md:p-10 shadow-sm">
            <div className="animate-pulse space-y-8">
              <div className="flex flex-col gap-6 lg:flex-row lg:justify-between">
                <div className="h-12 w-full max-w-lg rounded-lg bg-emerald-100/90" />
                <div className="h-40 w-48 shrink-0 rounded-3xl bg-white/90" />
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="h-28 rounded-2xl bg-[#2d4a43]/40" />
                <div className="h-28 rounded-2xl bg-white shadow-md" />
                <div className="h-28 rounded-2xl bg-white shadow-md" />
              </div>
            </div>
          </section>
        ) : (
          <header className="relative w-full rounded-[40px] bg-[#f4fbf7] px-6 py-8 shadow-sm md:px-10 md:py-10">
            <button
              type="button"
              onClick={handleResetOrders}
              className="absolute right-3 top-3 z-20 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-zinc-400 opacity-70 transition hover:text-zinc-600 hover:opacity-100"
              title="Sunum: siparişleri sıfırla"
            >
              Sıfırla
            </button>
            <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1 space-y-3">
                <p className="text-2xl font-bold tracking-tight text-emerald-600 md:text-3xl">
                  CampusBite Dashboard
                </p>
                <h1 className="text-2xl font-bold leading-tight tracking-tight text-[#1a2e35] md:text-4xl">
                  Hoş geldin, {rankLabel}!
                </h1>
                <p className="max-w-xl text-[15px] font-semibold leading-relaxed text-[#1a2e35] md:text-base">
                  Kampüste akıllı, hızlı ve israfı azaltan lezzetler — net, hızlı,
                  sürdürülebilir.
                </p>
              </div>

              <div className="flex w-full shrink-0 flex-col items-center gap-4 lg:max-w-[min(100%,320px)] lg:items-end">
                <button
                  type="button"
                  onClick={() => setPlantModalOpen(true)}
                  className="group relative flex min-h-[11rem] min-w-[11rem] cursor-pointer items-center justify-center rounded-[28px] border border-emerald-200/80 bg-white/90 px-2 shadow-sm outline-none transition-transform duration-300 hover:scale-110 hover:border-emerald-300 hover:shadow-lg hover:ring-2 hover:ring-emerald-400/40 focus-visible:ring-2 focus-visible:ring-emerald-500"
                  aria-label="Yeşilcan özeti ve CO₂ bilgisi"
                >
                  <span
                    className="inline-block select-none text-9xl leading-none motion-safe:animate-pulse group-hover:animate-none"
                    aria-hidden
                  >
                    {yesilcan.emoji}
                  </span>
                </button>

                <div className="w-full max-w-sm rounded-2xl border border-emerald-200/60 bg-white/90 px-4 py-3 shadow-sm backdrop-blur-sm lg:max-w-none">
                  <p className="text-center text-sm font-bold leading-snug text-[#1a2e35] lg:text-right">
                    {yesilcan.description}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <div className="h-4 min-w-0 flex-1 overflow-hidden rounded-full bg-emerald-200/70">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-500 ease-out"
                        style={{ width: `${yesilcan.progress}%` }}
                      />
                    </div>
                    <span className="shrink-0 text-[11px] font-bold tabular-nums text-[#1a2e35]">
                      {orderCountN}/10
                    </span>
                  </div>
                  <p className="mt-2 text-center text-xs font-bold leading-snug text-emerald-700 lg:text-right">
                    {kocaCanarStepText}
                  </p>
                  <p className="mt-1 text-center text-[11px] font-bold tabular-nums text-[#1a2e35] lg:text-right">
                    {orderCountN} sipariş · Yeşilcan evrimi
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-5">
              <div className="flex flex-col justify-center rounded-2xl bg-[#2d4a43] px-5 py-5 shadow-md ring-1 ring-emerald-900/20">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white">
                  Rütbe
                </p>
                <span className="mt-4 inline-flex w-fit max-w-full items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-[#2d4a43] shadow-sm transition-all duration-300">
                  <span className="text-xl leading-none" aria-hidden>
                    {rankEmoji}
                  </span>
                  {rankLabel}
                </span>
              </div>

              <div className={statCardWhite}>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#1a2e35]">
                  Toplam Kurtarılan Paket
                </p>
                <p className="mt-3 text-4xl font-bold tabular-nums leading-none text-[#1a2e35]">
                  {orderCountN}
                </p>
              </div>

              <div className={statCardWhite}>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#1a2e35]">
                  Karbon Tasarrufu
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <LeafIcon className="shrink-0 text-emerald-600" />
                  <p className="text-2xl font-bold tabular-nums text-[#1a2e35] md:text-3xl">
                    {carbonKg}{" "}
                    <span className="text-lg font-bold md:text-xl">kg CO₂</span>
                  </p>
                </div>
              </div>
            </div>
          </header>
        )}

        {loadError && (
          <div
            className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-[#1a2e35] shadow-sm"
            role="alert"
          >
            {loadError}
          </div>
        )}

        <section
          aria-labelledby="quick-analysis-heading"
          className="overflow-hidden rounded-[32px] border-2 border-emerald-200/70 bg-gradient-to-br from-[#f4fbf7] via-white to-sky-50/60 p-6 shadow-lg ring-1 ring-emerald-100/80 md:p-8"
        >
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-600/90">
                CampusBite
              </p>
              <h2
                id="quick-analysis-heading"
                className="mt-1 text-lg font-bold text-[#1a2e35] md:text-xl"
              >
                Hızlı sürdürülebilirlik analizi
              </h2>
              <p className="mt-1 max-w-xl text-sm font-semibold text-[#1a2e35]/75">
                Ürün adını yaz; AI lezzet + çevre etkisini tek cümlede özetlesin.
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-stretch sm:gap-3">
            <label className="min-w-0 flex-1">
              <span className="sr-only">Ürün adı</span>
              <input
                type="text"
                value={manualProductName}
                onChange={(e) => setManualProductName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !manualAnalyzing) void handleManualAnalyze();
                }}
                placeholder="Ürün adı yazın (örn: Karışık Sandviç)"
                disabled={manualAnalyzing}
                className="w-full rounded-2xl border-2 border-emerald-200/80 bg-white/95 px-4 py-3.5 text-[15px] font-semibold text-[#1a2e35] shadow-inner shadow-emerald-100/40 outline-none ring-emerald-300/30 placeholder:text-[#1a2e35]/35 focus:border-emerald-400/90 focus:ring-4 focus:ring-emerald-200/50 disabled:opacity-60"
                autoComplete="off"
              />
            </label>
            <button
              type="button"
              onClick={() => void handleManualAnalyze()}
              disabled={manualAnalyzing}
              className="shrink-0 rounded-2xl border-2 border-emerald-400/50 bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500 px-8 py-3.5 text-sm font-bold text-white shadow-md transition-all duration-300 hover:border-emerald-500 hover:from-emerald-500 hover:via-teal-500 hover:to-cyan-600 hover:shadow-lg hover:brightness-[1.02] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
            >
              {manualAnalyzing ? "Analiz ediliyor…" : "Analiz Et 🥪"}
            </button>
          </div>

          {manualError && (
            <p
              className="mt-4 rounded-xl border border-amber-200/90 bg-amber-50/90 px-4 py-2 text-sm font-bold text-[#1a2e35]"
              role="alert"
            >
              {manualError}
            </p>
          )}

          {manualPanel && (
            <div className="mt-6 space-y-3">
              <div
                className="overflow-hidden rounded-[28px] border-2 border-emerald-200/50 bg-gradient-to-b from-white via-[#f4fbf7] to-sky-50/30 p-5 shadow-md md:p-8"
                role="region"
                aria-label="Sürdürülebilirlik paneli"
              >
                <p className="text-center text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-600">
                  Sürdürülebilirlik Paneli
                </p>

                <div className="mt-6 flex justify-center">
                  <div
                    className="rounded-full p-[6px] shadow-md"
                    style={{
                      background: `conic-gradient(from -90deg, rgb(52 211 153) ${(manualPanel.impact_score / 100) * 360}deg, rgb(204 251 241) 0deg)`,
                    }}
                  >
                    <div className="flex h-[min(11rem,40vw)] w-[min(11rem,40vw)] min-h-[9rem] min-w-[9rem] flex-col items-center justify-center rounded-full bg-[#f8fdfb] ring-1 ring-emerald-100/80 sm:h-44 sm:w-44">
                      <span className="text-5xl font-extrabold tabular-nums leading-none text-emerald-700 sm:text-6xl">
                        {manualPanel.impact_score}
                      </span>
                      <span className="mt-1 text-xs font-bold text-[#1a2e35]/45">
                        /100
                      </span>
                      <span className="mt-2 text-[10px] font-bold uppercase tracking-wider text-emerald-600/90">
                        Etki puanı
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
                  <div className="flex flex-col rounded-2xl border border-sky-200/80 bg-sky-50/90 p-4 shadow-sm ring-1 ring-sky-100/60">
                    <div className="flex items-center gap-2">
                      <DropletIcon className="shrink-0 text-sky-500" />
                      <p className="text-[10px] font-bold uppercase tracking-wide text-[#1a2e35]/55">
                        Su tasarrufu
                      </p>
                    </div>
                    <p className="mt-3 text-xl font-extrabold tabular-nums text-sky-800">
                      ≈ {formatWaterLiters(manualPanel.water_liters)}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold leading-snug text-[#1a2e35]/55">
                      Tahmini su ayak izi (litre)
                    </p>
                  </div>

                  <div className="flex flex-col rounded-2xl border border-emerald-200/80 bg-emerald-50/90 p-4 shadow-sm ring-1 ring-emerald-100/60">
                    <div className="flex items-center gap-2">
                      <TreeIcon className="shrink-0 text-emerald-600" />
                      <p className="text-[10px] font-bold uppercase tracking-wide text-[#1a2e35]/55">
                        CO₂ engelleme
                      </p>
                    </div>
                    <p className="mt-3 text-xl font-extrabold tabular-nums text-emerald-900">
                      ≈ {formatCo2Grams(manualPanel.co2_avoided)}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold leading-snug text-[#1a2e35]/55">
                      Tahmini CO₂ eşdeğeri
                    </p>
                  </div>

                  <div className="flex flex-col rounded-2xl border border-violet-200/75 bg-violet-50/90 p-4 shadow-sm ring-1 ring-violet-100/50">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-[#1a2e35]/55">
                      Yeşil puan
                    </p>
                    <div className="mt-3 flex items-baseline gap-1">
                      <span className="text-2xl font-extrabold tabular-nums text-violet-800">
                        {manualPanel.green_score}
                      </span>
                      <span className="text-sm font-bold text-[#1a2e35]/45">
                        /100
                      </span>
                    </div>
                    <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-violet-200/70">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-violet-400 to-fuchsia-400 transition-[width] duration-500 ease-out"
                        style={{ width: `${manualPanel.green_score}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-8 space-y-6 border-t border-emerald-200/40 pt-8">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-600">
                      Gurme yorumu
                    </p>
                    <p className="mt-2 text-sm font-semibold leading-relaxed text-[#1a2e35] md:text-[15px]">
                      {manualPanel.text}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-amber-200/60 bg-amber-50/80 px-4 py-3.5 shadow-inner">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-700/90">
                      Günün tavsiyesi
                    </p>
                    <p className="mt-2 text-sm font-semibold leading-relaxed text-[#1a2e35]">
                      {manualPanel.daily_tip}
                    </p>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleManualReset}
                className="text-xs font-bold text-[#1a2e35]/55 underline-offset-2 transition hover:text-emerald-700 hover:underline"
              >
                Yeni Analiz
              </button>
            </div>
          )}
        </section>

        <section aria-labelledby="today-heading">
          <h2
            id="today-heading"
            className="mb-6 text-xl font-bold text-[#1a2e35] md:text-2xl"
          >
            Bugünün Lezzetleri
          </h2>

          {isBootLoading ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse overflow-hidden rounded-[32px] border-2 border-emerald-100 bg-white shadow-lg"
                >
                  <div className="aspect-[16/10] bg-emerald-100/80" />
                  <div className="space-y-3 p-5">
                    <div className="h-3 w-32 rounded bg-emerald-100" />
                    <div className="h-7 w-4/5 rounded bg-[#1a2e35]/15" />
                    <div className="h-16 w-full rounded bg-[#1a2e35]/10" />
                  </div>
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="rounded-[32px] border-2 border-emerald-200 bg-[#f4fbf7] px-8 py-16 text-center shadow-lg">
              <p className="font-bold text-[#1a2e35]">Henüz ürün yok</p>
              <p className="mt-2 text-sm font-semibold text-[#1a2e35]">
                Supabase `products` tablosuna kayıt ekleyerek burada
                gösterebilirsin.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-7 md:grid-cols-2 lg:grid-cols-3 lg:gap-8">
              {products.map((item) => {
                const kind = getPastelKind(item.category, item.name);
                const pc = pastelCard[kind];
                return (
                  <article
                    key={item.id}
                    data-gemini-comment={geminiComments[item.id] ?? ""}
                    data-gemini-impact={
                      geminiImpactScores[item.id] !== undefined
                        ? String(geminiImpactScores[item.id])
                        : ""
                    }
                    className={`group relative flex flex-col overflow-hidden rounded-[32px] border-2 ${pc.border} ${pc.bg} shadow-lg transition duration-300 ease-out hover:z-10 hover:scale-105 hover:shadow-2xl`}
                  >
                    <span
                      className="leaf-fly-on-hover absolute bottom-24 left-3 z-10 text-3xl drop-shadow-md"
                      aria-hidden
                    >
                      🍃
                    </span>

                    <div className="relative aspect-[16/10] w-full overflow-hidden rounded-t-[28px]">
                      <div className="absolute left-3 top-3 z-10 flex max-w-[calc(100%-1.5rem)] flex-wrap gap-1.5">
                        {item.badges.map((b) => (
                          <span
                            key={b.key}
                            className={`shadow-sm ${b.className}`}
                          >
                            {b.label === "Popüler"
                              ? "🔥 "
                              : b.label.includes("Vegan")
                                ? "🌱 "
                                : b.label.includes("Gluten")
                                  ? "🌾 "
                                  : b.label.includes("Protein")
                                    ? "🍗 "
                                    : ""}
                            {b.label}
                          </span>
                        ))}
                      </div>
                      <img
                        src={item.imageUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </div>

                    <div className="flex flex-1 flex-col p-5 md:p-6">
                      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#1a2e35]">
                        CAMPUSBITE NOKTASI
                      </p>
                      <h3 className="mt-2 text-xl font-bold leading-snug text-[#1a2e35] md:text-[1.35rem]">
                        {item.name}
                      </h3>

                      <div className="mt-4 rounded-2xl border border-[#1a2e35]/10 bg-white/70 p-3.5 shadow-inner">
                        <p className="text-sm font-semibold leading-relaxed text-[#1a2e35]">
                          {item.ingredients
                            .trim()
                            .toLocaleLowerCase("tr-TR")
                            .startsWith("içindekiler")
                            ? item.ingredients
                            : `İçindekiler: ${item.ingredients}`}
                        </p>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-4 text-sm font-bold text-[#1a2e35]">
                        <span className="inline-flex items-center gap-1.5">
                          <FlameIcon className="text-orange-500" />
                          {Math.round(item.caloriesKcal)} kcal
                        </span>
                        <span className="font-bold text-[#1a2e35]">·</span>
                        <span className="inline-flex items-center gap-1.5">
                          <DumbbellIcon className="text-emerald-600" />
                          {item.proteinG}g Protein
                        </span>
                      </div>

                      <div className="mt-4 space-y-2 text-sm font-semibold text-[#1a2e35]">
                        <p className="flex items-center gap-2">
                          <ClockIcon className="shrink-0 text-[#1a2e35]" />
                          Teslim: {item.deliveryWindow}
                        </p>
                        <p className="flex items-center gap-2">
                          <LeafIcon className="shrink-0 text-emerald-600" />
                          Tasarruf: {item.savingsCo2Kg.toFixed(2)} kg CO₂
                        </p>
                      </div>

                      <div
                        className={`mt-5 flex flex-wrap items-center justify-between gap-3 border-t-2 pt-5 ${pc.borderTop}`}
                      >
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="inline-flex rounded-xl bg-orange-100 px-4 py-2 text-lg font-extrabold tabular-nums text-orange-700 shadow-sm">
                            {item.priceLabel}
                          </span>
                          <span className="text-sm font-bold tabular-nums text-[#1a2e35]">
                            ⭐ {item.rating.toFixed(1)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => handleOrder(item, e)}
                          disabled={orderingId === item.id}
                          className="shrink-0 rounded-full bg-[#00c853] px-7 py-3 text-sm font-bold text-white shadow-md transition hover:bg-[#00b34a] disabled:opacity-50"
                        >
                          {orderingId === item.id ? "Bekleyin" : "Paketi Al"}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {leafParticles.length > 0 && (
        <div
          className="pointer-events-none fixed inset-0 z-[100] overflow-hidden"
          aria-hidden
        >
          {leafParticles.map((p) => (
            <span
              key={p.id}
              className="animate-leaf-confetti absolute text-2xl"
              style={
                {
                  left: p.left,
                  top: p.top,
                  "--tx": `${p.tx}px`,
                  "--ty": `${p.ty}px`,
                  "--rot": `${p.rot}deg`,
                  animationDelay: `${p.delay}ms`,
                } as CSSProperties
              }
            >
              🍃
            </span>
          ))}
        </div>
      )}

      {plantModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
          role="presentation"
          onClick={() => setPlantModalOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="plant-modal-title"
            className="w-full max-w-md rounded-[24px] border border-emerald-100 bg-white p-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center text-9xl leading-none" aria-hidden>
              {yesilcan.emoji}
            </div>
            <h3
              id="plant-modal-title"
              className="mt-4 text-center text-lg font-bold text-[#1a2e35]"
            >
              Yeşilcan özeti
            </h3>
            <p className="mt-4 text-center text-sm font-semibold leading-relaxed text-[#1a2e35]">
              Şu ana kadar yaklaşık{" "}
              <span className="font-bold text-emerald-600">
                {carbonKg} kg CO₂
              </span>{" "}
              tasarrufuna katkı sağladın.
            </p>
            <div className="mt-5 rounded-2xl border border-emerald-100 bg-[#f4fbf7] px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-600">
                Sıradaki sürpriz
              </p>
              <p className="mt-2 text-sm font-bold leading-relaxed text-[#1a2e35]">
                {nextSurpriseText}
              </p>
            </div>
            <p className="mt-4 text-center text-xs font-bold text-[#1a2e35]">
              Toplam sipariş:{" "}
              <span className="tabular-nums text-[#1a2e35]">{orderCountN}</span>
            </p>
            <button
              type="button"
              onClick={() => setPlantModalOpen(false)}
              className="mt-8 w-full rounded-full bg-[#2d4a43] py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#243d37]"
            >
              Kapat
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-8 left-1/2 z-[90] max-w-sm -translate-x-1/2 rounded-2xl border border-emerald-100 bg-white px-6 py-3 text-center text-sm font-bold text-[#1a2e35] shadow-lg">
          {toast}
        </div>
      )}
    </main>
  );
}
