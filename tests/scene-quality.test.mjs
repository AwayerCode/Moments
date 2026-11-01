import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldHandleSceneShortcut } from '../src/lib/sceneKeyboard.ts';
import { selectRenderQuality } from '../src/scene/renderQuality.ts';

test('compact viewports use the direct, lighter render path', () => {
  const quality = selectRenderQuality({
    viewportWidth: 390,
    viewportHeight: 844,
    devicePixelRatio: 3,
  });

  assert.equal(quality.compact, true);
  assert.equal(quality.usePostProcessing, false);
  assert.equal(quality.pixelRatio, 1.4);
  assert.equal(quality.shadowMapSize, 1024);
});

test('desktop keeps bounded high-density post processing', () => {
  const quality = selectRenderQuality({
    viewportWidth: 1440,
    viewportHeight: 900,
    devicePixelRatio: 2,
  });

  assert.equal(quality.compact, false);
  assert.equal(quality.usePostProcessing, true);
  assert.equal(quality.pixelRatio, 1.75);
  assert.equal(quality.samples, 2);
  assert.equal(quality.photoTextureWidth, 1280);
});

test('scene shortcuts defer to interactive controls', () => {
  const button = {
    closest: (selector) => (selector.includes('button') ? {} : null),
  };
  const canvas = { closest: () => null };

  assert.equal(shouldHandleSceneShortcut(button), false);
  assert.equal(shouldHandleSceneShortcut(canvas), true);
  assert.equal(shouldHandleSceneShortcut(null), true);
});
