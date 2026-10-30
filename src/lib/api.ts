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

export async function fetchSession(): Promise<boolean> {
  const response = await fetch("/api/session", { credentials: "same-origin" });
  return response.ok;
}

export async function createSession(
  name: string,
): Promise<{ ok: boolean; error?: string; status: number }> {
  const response = await fetch("/api/session", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name }),
  });
  const data = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
  };
  return {
    ok: Boolean(data.ok && response.ok),
    error: data.error,
    status: response.status,
  };
}

export async function fetchMoments(): Promise<MomentItem[]> {
  const response = await fetch("/api/moments", { credentials: "same-origin" });
  if (response.status === 401) {
    throw new Error("unauthorized");
  }
  if (!response.ok) {
    throw new Error("moments_failed");
  }
  const data = (await response.json()) as { items?: MomentItem[] };
  return data.items ?? [];
}
