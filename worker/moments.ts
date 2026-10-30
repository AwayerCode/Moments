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
  { id: "m1", caption: "2025.09.15 · 1岁9个月", x: 65, y: 220, width: 210, height: 275, rotate: -10, palette: "lilac", pin: "top" },
  { id: "m2", caption: "2025.03.02 · 1岁3个月", x: 310, y: 245, width: 125, height: 165, rotate: -6, palette: "mint", pin: "top" },
  { id: "m3", caption: "2024.11.20 · 0岁11个月", x: 475, y: 235, width: 170, height: 225, rotate: 8, palette: "sky", pin: "top" },
  { id: "m4", caption: "2025.01.18 · 1岁1个月", x: 350, y: 445, width: 82, height: 108, rotate: 3, palette: "peach", pin: "top" },
  { id: "m5", caption: "2024.08.04 · 0岁8个月", x: 48, y: 590, width: 105, height: 145, rotate: -7, palette: "mint", pin: "top" },
  { id: "m6", caption: "2025.07.22 · 1岁7个月", x: 180, y: 555, width: 135, height: 185, rotate: 10, palette: "sky", pin: "top" },
  { id: "m7", caption: "2025.06.08 · 1岁6个月", x: 330, y: 590, width: 210, height: 280, rotate: 5, palette: "peach", pin: "top" },
  { id: "m8", caption: "2024.12.01 · 1岁0个月", x: 565, y: 520, width: 105, height: 155, rotate: 2, palette: "lilac", pin: "top" },
  { id: "m9", caption: "2025.04.30 · 1岁4个月", x: 585, y: 725, width: 100, height: 140, rotate: 8, palette: "butter", pin: "top" },
  { id: "m10", caption: "2025.10.12 · 1岁10个月", x: 75, y: 780, width: 85, height: 120, rotate: -8, palette: "sky", pin: "top" },
  { id: "m11", caption: "2024.09.09 · 0岁9个月", x: 200, y: 770, width: 90, height: 125, rotate: 2, palette: "mint", pin: "top" },
  { id: "m12", caption: "2025.02.14 · 1岁2个月", x: 75, y: 940, width: 160, height: 210, rotate: -7, palette: "mint", pin: "top" },
  { id: "m13", caption: "2025.08.19 · 1岁8个月", x: 275, y: 960, width: 145, height: 195, rotate: 4, palette: "sky", pin: "top" },
  { id: "m14", caption: "2025.05.05 · 1岁5个月", x: 455, y: 990, width: 83, height: 117, rotate: -2, palette: "butter", pin: "top" },
  { id: "m15", caption: "2024.07.07 · 0岁7个月", x: 560, y: 925, width: 120, height: 180, rotate: 8, palette: "lilac", pin: "top" },
  { id: "m16", caption: "2025.09.15 · 1岁9个月", x: 465, y: 440, width: 65, height: 85, rotate: -5, palette: "sky", pin: "top" },
];

export async function listMoments(env: Env): Promise<MomentItem[]> {
  if (!env.MOMENTS_BUCKET) throw new Error("missing_bucket");
  const items: MomentItem[] = [];
  let cursor: string | undefined;
  let metadataCount = 0;
  do {
    const listed = await env.MOMENTS_BUCKET.list({ prefix: "moments/", cursor });
    for (const object of listed.objects) {
      if (!object.key.endsWith(".json")) continue;
      metadataCount++;
      const body = await env.MOMENTS_BUCKET.get(object.key);
      if (!body) continue;
      let parsed: unknown;
      try {
        parsed = await body.json();
      } catch {
        continue; // A malformed record must not hide other photos.
      }
      const item = parseMoment(parsed);
      if (item) items.push(item);
    }
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);
  if (items.length) return items;
  if (metadataCount) throw new Error("invalid_moments");
  return PLACEHOLDER_MOMENTS;
}

function parseMoment(value: unknown): MomentItem | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  if (typeof item.id !== "string" || !item.id ||
      typeof item.caption !== "string" || !item.caption ||
      !["peach", "sky", "mint", "lilac", "butter"].includes(String(item.palette))) return null;
  for (const key of ["x", "y", "width", "height", "rotate"]) {
    if (item[key] !== undefined && (typeof item[key] !== "number" || !Number.isFinite(item[key]))) return null;
  }
  if ((typeof item.width === "number" && item.width <= 0) ||
      (typeof item.height === "number" && item.height <= 0)) return null;
  if (item.pin !== undefined && !["tl", "tr", "top"].includes(String(item.pin))) return null;
  return {
    id: item.id, caption: item.caption, palette: item.palette as Palette,
    x: item.x as number ?? 0, y: item.y as number ?? 0,
    width: item.width as number ?? 140, height: item.height as number ?? 176,
    rotate: item.rotate as number ?? 0, pin: item.pin as MomentItem["pin"] ?? "top",
  };
}
