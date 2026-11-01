import assert from 'node:assert/strict';
import test from 'node:test';
import { LAYOUT, cardSlot, galleryPanBounds, rubberBandPan, settlePanX } from '../src/scene/galleryLayout.ts';
const cards = n => Array.from({length:n},(_,i)=>cardSlot(i));
for (const halfWidth of [1.5, 3.6]) {
  test(`both edges are reachable at viewport half width ${halfWidth}`, () => {
    for (const n of [1,9,12,18,19,48,96]) {
      const items=cards(n), bounds=galleryPanBounds(items,halfWidth);
      assert.ok(bounds.max>=bounds.min);
      for (const item of items) {
        assert.ok(item.x >= bounds.min-halfWidth);
        assert.ok(item.x <= bounds.max+halfWidth);
      }
      let x=bounds.min;
      for(let i=0;i<2000;i++) x=rubberBandPan(x,.4,bounds.min,bounds.max);
      assert.equal(x,bounds.max);
      for(let i=0;i<2000;i++) x=settlePanX(rubberBandPan(x,-.4,bounds.min,bounds.max),bounds.min,bounds.max);
      assert.equal(x,bounds.min);
    }
  });
}
test('appending rows never retracts the right boundary',()=>{
  let previous=-Infinity;
  for(let n=9;n<=100;n++){
    const max=galleryPanBounds(cards(n),1.5).max;
    assert.ok(max>=previous); previous=max;
  }
});
test('adjacent rows do not overlap at maximum print scale',()=>{
  assert.ok(LAYOUT.rowSpacing > 1.84*1.04);
});
test('new bays move along the same world wall',()=>{
  assert.ok(cardSlot(9).x>cardSlot(0).x+6);
  assert.ok(Math.abs(cardSlot(9).z-cardSlot(0).z)<.03);
});
