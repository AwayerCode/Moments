export type Palette = "peach" | "sky" | "mint" | "lilac" | "butter";
/** Content only; world layout is owned by the scene. */
export type MomentItem = { id: string; caption: string; src?: string; palette: Palette };
export type MomentsPage = { items: MomentItem[]; nextCursor: string | null };
