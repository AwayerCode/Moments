import assert from 'node:assert/strict';
import test from 'node:test';
import { listMoments } from '../worker/moments.ts';

const valid = { id: 'photo', caption: 'Example', palette: 'sky' };
function envFor(records) {
  return { MOMENTS_BUCKET: {
    list: async () => ({ objects: Object.keys(records).map(key => ({ key })), truncated: false }),
    get: async key => ({ json: async () => JSON.parse(records[key]) }),
  } };
}

test('a broken JSON or invalid record does not hide valid photos', async () => {
  const items = await listMoments(envFor({
    'moments/bad.json': '{',
    'moments/null.json': 'null',
    'moments/invalid.json': JSON.stringify({ ...valid, width: -1 }),
    'moments/valid.json': JSON.stringify(valid),
  }));
  assert.equal(items.length, 1);
  assert.equal(items[0].id, valid.id);
});

test('only an empty bucket returns demo content', async () => {
  assert.equal((await listMoments(envFor({}))).length, 16);
  await assert.rejects(listMoments(envFor({ 'moments/bad.json': '{' })));
  await assert.rejects(listMoments({ MOMENTS_BUCKET: { list: async () => { throw new Error('unavailable'); } } }));
});

test('continues listing past the first R2 page', async () => {
  const cursors = [];
  const items = await listMoments({ MOMENTS_BUCKET: {
    list: async ({ cursor }) => {
      cursors.push(cursor);
      return cursor
        ? { objects: [{ key: 'moments/photo.json' }], truncated: false }
        : { objects: [], truncated: true, cursor: 'page2' };
    },
    get: async () => ({ json: async () => valid }),
  } });
  assert.deepEqual(cursors, [undefined, 'page2']);
  assert.equal(items[0].id, valid.id);
});
