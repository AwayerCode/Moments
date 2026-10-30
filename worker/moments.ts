export type Palette = "peach" | "sky" | "mint" | "lilac" | "butter";

export type MomentItem = {
  id: string;
  caption: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotate: number;
  palette: Palette;
  pin: "tl" | "tr" | "top";
};

/**
 * Abstract pastel placeholders only. No real photos, names, or birthdays.
 * Captions use fictional dates/ages for layout.
 */
export const PLACEHOLDER_MOMENTS: MomentItem[] = [
  {
    id: "m1",
    caption: "2025.09.15 · 1岁9个月",
    x: 180,
    y: 220,
    width: 168,
    height: 210,
    rotate: -6,
    palette: "sky",
    pin: "top",
  },
  {
    id: "m2",
    caption: "2025.03.02 · 1岁3个月",
    x: 420,
    y: 160,
    width: 118,
    height: 148,
    rotate: 8,
    palette: "lilac",
    pin: "tr",
  },
  {
    id: "m3",
    caption: "2024.11.20 · 0岁11个月",
    x: 620,
    y: 280,
    width: 132,
    height: 166,
    rotate: -3,
    palette: "mint",
    pin: "tl",
  },
  {
    id: "m4",
    caption: "2025.06.08 · 1岁6个月",
    x: 880,
    y: 190,
    width: 210,
    height: 262,
    rotate: 3,
    palette: "peach",
    pin: "top",
  },
  {
    id: "m5",
    caption: "2025.01.18 · 1岁1个月",
    x: 1180,
    y: 250,
    width: 104,
    height: 132,
    rotate: -8,
    palette: "butter",
    pin: "tr",
  },
  {
    id: "m6",
    caption: "2024.08.04 · 0岁8个月",
    x: 1360,
    y: 170,
    width: 150,
    height: 188,
    rotate: 5,
    palette: "sky",
    pin: "tl",
  },
  {
    id: "m7",
    caption: "2025.07.22 · 1岁7个月",
    x: 240,
    y: 520,
    width: 112,
    height: 142,
    rotate: 7,
    palette: "butter",
    pin: "top",
  },
  {
    id: "m8",
    caption: "2024.12.01 · 1岁0个月",
    x: 460,
    y: 480,
    width: 186,
    height: 232,
    rotate: -4,
    palette: "lilac",
    pin: "tr",
  },
  {
    id: "m9",
    caption: "2025.04.30 · 1岁4个月",
    x: 760,
    y: 540,
    width: 124,
    height: 156,
    rotate: 10,
    palette: "mint",
    pin: "tl",
  },
  {
    id: "m10",
    caption: "2025.10.12 · 1岁10个月",
    x: 1040,
    y: 500,
    width: 160,
    height: 200,
    rotate: -2,
    palette: "sky",
    pin: "top",
  },
  {
    id: "m11",
    caption: "2024.09.09 · 0岁9个月",
    x: 1320,
    y: 480,
    width: 108,
    height: 136,
    rotate: 6,
    palette: "peach",
    pin: "tr",
  },
  {
    id: "m12",
    caption: "2025.02.14 · 1岁2个月",
    x: 200,
    y: 780,
    width: 146,
    height: 184,
    rotate: -7,
    palette: "mint",
    pin: "tl",
  },
  {
    id: "m13",
    caption: "2025.08.19 · 1岁8个月",
    x: 500,
    y: 820,
    width: 120,
    height: 150,
    rotate: 4,
    palette: "peach",
    pin: "top",
  },
  {
    id: "m14",
    caption: "2025.05.05 · 1岁5个月",
    x: 780,
    y: 780,
    width: 198,
    height: 248,
    rotate: -5,
    palette: "butter",
    pin: "tr",
  },
  {
    id: "m15",
    caption: "2024.07.07 · 0岁7个月",
    x: 1120,
    y: 800,
    width: 128,
    height: 160,
    rotate: 9,
    palette: "lilac",
    pin: "tl",
  },
  {
    id: "m16",
    caption: "2025.09.15 · 1岁9个月",
    x: 1380,
    y: 740,
    width: 154,
    height: 192,
    rotate: -3,
    palette: "sky",
    pin: "top",
  },
];

export async function listMoments(env: Env): Promise<MomentItem[]> {
  // Private R2 (MOMENTS_BUCKET → sisi-moments). Empty bucket → placeholders.
  if (env.MOMENTS_BUCKET) {
    try {
      const listed = await env.MOMENTS_BUCKET.list({ prefix: "moments/" });
      const fromR2: MomentItem[] = [];
      for (const object of listed.objects) {
        if (!object.key.endsWith(".json")) {
          continue;
        }
        const body = await env.MOMENTS_BUCKET.get(object.key);
        if (!body) {
          continue;
        }
        const parsed = (await body.json()) as Partial<MomentItem>;
        if (parsed.id && parsed.caption && parsed.palette) {
          fromR2.push({
            id: parsed.id,
            caption: parsed.caption,
            x: parsed.x ?? 0,
            y: parsed.y ?? 0,
            width: parsed.width ?? 140,
            height: parsed.height ?? 176,
            rotate: parsed.rotate ?? 0,
            palette: parsed.palette,
            pin: parsed.pin ?? "top",
          });
        }
      }
      if (fromR2.length > 0) {
        return fromR2;
      }
    } catch {
      // Local empty stub or missing bucket — fall through to placeholders.
    }
  }
  return PLACEHOLDER_MOMENTS;
}
