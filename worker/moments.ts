import type { MomentItem, Palette } from "../shared/moments.ts";
import { PLACEHOLDER_MOMENTS } from "../shared/demoMoments.ts";


export type MomentsPage = {
  items: MomentItem[];
  nextCursor?: string;
};

/** Load one metadata page. Image bytes are never read while listing. */
export async function listMomentsPage(
  env: Env,
  cursor?: string,
  requestedLimit = 48,
): Promise<MomentsPage> {
  if (!env.MOMENTS_BUCKET) throw new Error("missing_bucket");
  const limit = Math.max(1, Math.min(96, Math.floor(requestedLimit)));
  const listed = await env.MOMENTS_BUCKET.list({
    prefix: "moments/",
    cursor,
    limit,
  });
  const items: MomentItem[] = [];
  let metadataCount = 0;

  for (const object of listed.objects) {
    if (!object.key.endsWith(".json")) continue;
    metadataCount++;
    const body = await env.MOMENTS_BUCKET.get(object.key);
    if (!body) continue;
    let parsed: unknown;
    try {
      parsed = await body.json();
    } catch {
      continue;
    }
    const item = parseMoment(parsed);
    if (item) items.push(item);
  }

  const nextCursor = listed.truncated ? listed.cursor : undefined;
  if (items.length) return { items, nextCursor };
  if (metadataCount && !nextCursor) throw new Error("invalid_moments");
  if (!metadataCount && !cursor && listed.objects.length === 0) {
    return { items: PLACEHOLDER_MOMENTS };
  }
  return { items, nextCursor };
}

function parseMoment(value: unknown): MomentItem | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  if (typeof item.id !== "string" || !item.id ||
      typeof item.caption !== "string" || !item.caption ||
      !["peach", "sky", "mint", "lilac", "butter"].includes(String(item.palette))) return null;
  if (item.src !== undefined &&
      (typeof item.src !== "string" || !item.src.startsWith("/api/media/"))) return null;
  for (const key of ["x", "y", "width", "height", "rotate"]) {
    if (item[key] !== undefined && (typeof item[key] !== "number" || !Number.isFinite(item[key]))) return null;
  }
  if ((typeof item.width === "number" && item.width <= 0) ||
      (typeof item.height === "number" && item.height <= 0)) return null;
  if (item.pin !== undefined && !["tl", "tr", "top"].includes(String(item.pin))) return null;
  return {
    id: item.id, caption: item.caption, palette: item.palette as Palette,
    src: item.src as string | undefined,
  };
}
