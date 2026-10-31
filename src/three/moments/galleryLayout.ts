/** Frontal wall layout and horizontal-pan rules for the Moments scene. */

export const LAYOUT = {
  wallZ: -2.75,
  cardLift: 0.085,
  columns: 4,
  rows: 3,
  columnSpacing: 1.66,
  rowSpacing: 1.54,
  bayGap: 1.0,
  startX: 0,
  baseY: -1.12,
  /** How far the view can stretch past the left bound before it hard-stops. */
  overscroll: 1.05,
  /** Overscroll past the left bound that commits a return to the camera. */
  returnTrigger: 0.38,
  /** Overscroll is compressed so the wall feels rubbery, not linear. */
  rubber: 0.42,
} as const;

export const TIMING = {
  print: 0.95,
  firstDolly: 1.05,
  shortDolly: 0.62,
  returnDolly: 0.88,
  reducedFade: 0.16,
} as const;

const SLOT_ROTATION = [-0.052, 0.022, 0.061, -0.031, 0.012] as const;
const SLOT_SCALE = [1, 0.86, 0.96, 0.81, 1.04] as const;

export type CardSlot = {
  x: number;
  y: number;
  z: number;
  rotation: number;
  scale: number;
};

export function cardSlot(index: number): CardSlot {
  const column = index % LAYOUT.columns;
  const row = Math.floor(index / LAYOUT.columns) % LAYOUT.rows;
  const bay = Math.floor(index / (LAYOUT.columns * LAYOUT.rows));
  const jitterX = ((index * 17) % 13 - 6) * 0.052;
  const jitterY = ((index * 11) % 9 - 4) * 0.032;
  const bayWidth = LAYOUT.columns * LAYOUT.columnSpacing + LAYOUT.bayGap;
  return {
    x: LAYOUT.startX + column * LAYOUT.columnSpacing + bay * bayWidth + jitterX,
    y: LAYOUT.baseY + row * LAYOUT.rowSpacing + jitterY,
    z: LAYOUT.wallZ + LAYOUT.cardLift + (index % 4) * 0.006,
    rotation: SLOT_ROTATION[index % SLOT_ROTATION.length],
    scale: SLOT_SCALE[index % SLOT_SCALE.length],
  };
}

/** First gallery pose: centered on the opening field of prints, not one card. */
export function galleryStartX() {
  return LAYOUT.startX + LAYOUT.columnSpacing * 1.45;
}

export function galleryMaxX(lastCardX: number) {
  return Math.max(galleryStartX(), lastCardX - LAYOUT.columnSpacing * 1.2);
}

export function rubberBandPan(
  current: number,
  delta: number,
  minX: number,
  maxX: number,
) {
  const proposed = current + delta;
  if (proposed > maxX) return maxX;
  if (proposed >= minX) return proposed;
  const overflow = minX - proposed;
  return minX - Math.min(LAYOUT.overscroll, overflow * LAYOUT.rubber);
}

export function shouldReturnToCamera(x: number, minX: number) {
  return x <= minX - LAYOUT.returnTrigger;
}

export function settlePanX(x: number, minX: number, maxX: number) {
  if (x > maxX) return maxX;
  if (x < minX) return minX;
  return x;
}
