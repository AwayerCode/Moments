import assert from 'node:assert/strict';
import test from 'node:test';
import { listMomentsPage } from '../worker/moments.ts';

const valid = { id: 'photo', caption: 'Example', palette: 'sky' };
function envFor(records) {
  return { MOMENTS_BUCKET: {
    list: async () => ({ objects: Object.keys(records).map(key => ({ key })), truncated: false }),
    get: async key => ({ json: async () => JSON.parse(records[key]) }),
  } };
}

test('a broken JSON or invalid record does not hide valid photos', async () => {
  const items = await listMomentsPage(envFor({
    'moments/bad.json': '{',
    'moments/null.json': 'null',
    'moments/invalid.json': JSON.stringify({ ...valid, width: -1 }),
    'moments/valid.json': JSON.stringify(valid),
  }));
  assert.equal(items.items.length, 1);
  assert.equal(items.items[0].id, valid.id);
});

test('only an empty bucket returns demo content', async () => {
  assert.equal((await listMomentsPage(envFor({}))).items.length, 16);
  await assert.rejects(listMomentsPage(envFor({ 'moments/bad.json': '{' })));
  await assert.rejects(listMomentsPage({ MOMENTS_BUCKET: { list: async () => { throw new Error('unavailable'); } } }));
});

test('returns one metadata page and preserves the R2 cursor', async () => {
  const calls = [];
  const page = await listMomentsPage({ MOMENTS_BUCKET: {
    list: async options => {
      calls.push(options);
      return {
        objects: [{ key: 'moments/photo.json' }],
        truncated: true,
        cursor: 'next-page',
      };
    },
    get: async () => ({ json: async () => valid }),
  } }, 'current-page', 24);

  assert.deepEqual(calls, [{
    prefix: 'moments/',
    cursor: 'current-page',
    limit: 24,
  }]);
  assert.equal(page.items[0].id, valid.id);
  assert.equal(page.nextCursor, 'next-page');
});

test('rejects media URLs outside the authenticated Worker route', async () => {
  const items = await listMomentsPage(envFor({
    'moments/external.json': JSON.stringify({
      ...valid,
      id: 'external',
      src: 'https://public.example/photo.jpg',
    }),
    'moments/private.json': JSON.stringify({
      ...valid,
      id: 'private',
      src: '/api/media/moments/photo.jpg',
    }),
  }));

  assert.deepEqual(items.items.map(item => item.id), ['private']);
});
