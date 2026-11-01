import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const mac = '/Applications/Blender.app/Contents/MacOS/Blender';
const binary = process.env.BLENDER_BIN || (existsSync(mac) ? mac : 'blender');
const mode = process.argv[2];
if (mode === 'lookdev') {
  const result = spawnSync(binary, ['--background', '--python-exit-code', '1', '--python', 'scripts/export-lookdev.py'], {cwd: root, stdio: 'inherit'});
  if (result.error) throw result.error;
  process.exit(result.status || 0);
}
if (!['build', 'export'].includes(mode)) throw new Error('Use build or export');
for (const name of ['playroom', 'sisi-camera']) {
  const args = mode === 'build'
    ? ['--background', '--factory-startup', '--python-exit-code', '1', '--python', `assets/source/build_${name === 'sisi-camera' ? 'camera' : name}.py`]
    : ['--background', `assets/source/${name}.blend`, '--python-exit-code', '1', '--python', 'scripts/export-model.py', '--', `public/models/${name}.glb`];
  const result = spawnSync(binary, args, { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
