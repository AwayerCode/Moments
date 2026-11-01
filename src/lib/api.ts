import type { MomentItem, MomentsPage } from "../../shared/moments.ts";
export type { MomentItem, Palette } from "../../shared/moments.ts";

export async function claimInviteFromLocation(): Promise<boolean> {
  const pathMatch = window.location.pathname.match(/^\/i\/([^/]+)\/?$/);
  const queryInvite = new URL(window.location.href).searchParams.get("invite");
  const invite = pathMatch ? decodeURIComponent(pathMatch[1]) : queryInvite;
  if (!invite) return false;

  const response = await fetch("/api/session", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ invite }),
  });
  if (!response.ok) {
    throw new Error("invite_rejected");
  }
  window.history.replaceState({}, "", "/");
  return true;
}

export type { MomentsPage } from "../../shared/moments.ts";

export async function fetchMomentsPage(
  cursor?: string,
): Promise<MomentsPage> {
  const params = new URLSearchParams({ limit: "48" });
  if (cursor) params.set("cursor", cursor);
  const response = await fetch(`/api/moments?${params}`, {
    credentials: "same-origin",
  });
  if (response.status === 401) {
    throw new Error("unauthorized");
  }
  if (!response.ok) {
    throw new Error("moments_failed");
  }
  const data = (await response.json()) as {
    items?: MomentItem[];
    nextCursor?: string | null;
  };
  return {
    items: data.items ?? [],
    nextCursor: data.nextCursor ?? null,
  };
}
