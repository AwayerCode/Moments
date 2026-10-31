import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LAYOUT,
  TIMING,
  cardSlot,
  galleryMaxX,
  galleryStartX,
  rubberBandPan,
  settlePanX,
  shouldReturnToCamera,
} from '../src/three/moments/galleryLayout.ts';

test('cards sit on a frontal wall plane with mild variation', () => {
  const first = cardSlot(0);
  const second = cardSlot(1);
  assert.ok(Math.abs(first.z - (LAYOUT.wallZ + LAYOUT.cardLift)) < 0.01);
  assert.ok(second.x > first.x);
  assert.notEqual(first.rotation, second.rotation);
  assert.notEqual(first.scale, second.scale);
  assert.ok(first.scale > 0.7 && first.scale < 1.2);
});

test('later bays continue to the right instead of stacking in depth', () => {
  const firstBay = cardSlot(0);
  const nextBay = cardSlot(LAYOUT.columns * LAYOUT.rows);
  assert.ok(nextBay.x > firstBay.x + 6);
  assert.ok(Math.abs(nextBay.z - firstBay.z) < 0.03);
});

test('horizontal pan stays face-on: only X changes, with a left rubber band', () => {
  const minX = galleryStartX();
  const maxX = galleryMaxX(18);
  assert.equal(rubberBandPan(minX, 1.2, minX, maxX), minX + 1.2);
  assert.equal(rubberBandPan(maxX, 2, minX, maxX), maxX);

  const overscrolled = rubberBandPan(minX, -2, minX, maxX);
  assert.ok(overscrolled < minX);
  assert.ok(overscrolled >= minX - LAYOUT.overscroll);
  assert.ok(minX - overscrolled <= LAYOUT.overscroll);
});

test('left-edge overscroll past the trigger returns to the camera', () => {
  const minX = galleryStartX();
  assert.equal(shouldReturnToCamera(minX, minX), false);
  assert.equal(shouldReturnToCamera(minX - LAYOUT.returnTrigger + 0.01, minX), false);
  assert.equal(shouldReturnToCamera(minX - LAYOUT.returnTrigger, minX), true);
  assert.equal(settlePanX(minX - 0.2, minX, 10), minX);
});

test('first-time dolly stays inside the approved window; return is also short', () => {
  assert.ok(TIMING.firstDolly >= 0.8 && TIMING.firstDolly <= 1.2);
  assert.ok(TIMING.shortDolly < TIMING.firstDolly);
  assert.ok(TIMING.returnDolly < 1.2);
  assert.ok(TIMING.reducedFade < 0.3);
});
