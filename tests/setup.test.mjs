import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { detectTools, hasClaudePlugin, clipboardCommand, revealCommand, setup } from '../lib/setup.mjs';

let home;
beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'fs-setup-'));
  process.env.FIGMA_STEROIDS_HOME = home;
});
afterEach(() => {
  rmSync(home, { recursive: true, force: true });
  delete process.env.FIGMA_STEROIDS_HOME;
});

const quiet = () => {};

test('detecta las IAs por sus carpetas de configuración', () => {
  assert.deepEqual(detectTools(), []);
  mkdirSync(join(home, '.codex'));
  mkdirSync(join(home, '.config', 'opencode'), { recursive: true });
  assert.deepEqual(detectTools(), ['codex', 'opencode']);
  mkdirSync(join(home, '.claude'));
  mkdirSync(join(home, '.cursor'));
  assert.deepEqual(detectTools(), ['claude', 'codex', 'opencode', 'cursor']);
  mkdirSync(join(home, '.gemini', 'antigravity'), { recursive: true });
  assert.deepEqual(detectTools(), ['claude', 'codex', 'opencode', 'cursor', 'antigravity']);
});

test('setup instala en Antigravity: skills globales y su bloque en GEMINI.md', async () => {
  mkdirSync(join(home, '.gemini', 'antigravity'), { recursive: true });
  writeFileSync(join(home, '.gemini', 'GEMINI.md'), '# Mis reglas\n');
  const res = await setup({ installCli: false, open: false, wait: 0, log: quiet });
  assert.deepEqual(res.tools, ['antigravity']);
  assert.ok(existsSync(join(home, '.gemini', 'config', 'skills', 'figma-build-ui', 'SKILL.md')));
  const rules = readFileSync(join(home, '.gemini', 'GEMINI.md'), 'utf8');
  assert.ok(rules.startsWith('# Mis reglas'), 'conserva las reglas del usuario');
  assert.ok(rules.includes('figma-steroids'), 'añade su bloque');
});

test('reconoce el plugin de Claude Code ya instalado', () => {
  assert.equal(hasClaudePlugin(), false);
  mkdirSync(join(home, '.claude', 'plugins'), { recursive: true });
  writeFileSync(join(home, '.claude', 'plugins', 'installed_plugins.json'), '{"plugins":{"figma-steroids@figma-steroids":[]}}');
  assert.equal(hasClaudePlugin(), true);
});

test('portapapeles y explorador según el sistema', () => {
  assert.equal(clipboardCommand('win32')[0], 'powershell');
  assert.deepEqual(clipboardCommand('darwin'), ['pbcopy', []]);
  assert.deepEqual(clipboardCommand('linux', (c) => c === 'xclip'), ['xclip', ['-selection', 'clipboard']]);
  assert.equal(clipboardCommand('linux', () => false), null);
  assert.deepEqual(revealCommand('C:\\u\\m.json', 'win32'), ['explorer', ['/select,"C:\\u\\m.json"']]);
  assert.deepEqual(revealCommand('/u/m.json', 'darwin'), ['open', ['-R', '/u/m.json']]);
  assert.deepEqual(revealCommand('/u/p/m.json', 'linux'), ['xdg-open', ['/u/p']]);
});

test('setup instala las skills en cada IA detectada y copia el plugin', async () => {
  mkdirSync(join(home, '.codex'));
  mkdirSync(join(home, '.claude'));
  const res = await setup({ installCli: false, open: false, wait: 0, log: quiet });
  assert.equal(res.ok, true);
  assert.deepEqual(res.tools, ['claude', 'codex']);
  assert.ok(existsSync(join(home, '.claude', 'skills', 'figma-build-ui', 'SKILL.md')));
  assert.ok(existsSync(join(home, '.agents', 'skills', 'figma-build-ui', 'SKILL.md')));
  assert.ok(existsSync(join(home, '.codex', 'agents')));
  assert.ok(existsSync(res.manifest));
});

test('setup no duplica las skills si Claude Code ya tiene el plugin', async () => {
  mkdirSync(join(home, '.claude', 'plugins'), { recursive: true });
  writeFileSync(join(home, '.claude', 'plugins', 'installed_plugins.json'), '{"plugins":{"figma-steroids@figma-steroids":[]}}');
  const res = await setup({ installCli: false, open: false, wait: 0, log: quiet });
  assert.deepEqual(res.tools, []);
  assert.equal(existsSync(join(home, '.claude', 'skills', 'figma-build-ui')), false);
});

test('sin ninguna IA detectada instala en el destino universal', async () => {
  const res = await setup({ installCli: false, open: false, wait: 0, log: quiet });
  assert.deepEqual(res.tools, ['universal']);
  assert.ok(existsSync(join(home, '.agents', 'skills', 'figma-build-ui', 'SKILL.md')));
});

test('--dry-run no escribe nada', async () => {
  mkdirSync(join(home, '.codex'));
  const res = await setup({ installCli: false, open: false, dryRun: true, log: quiet });
  assert.equal(res.ok, true);
  assert.equal(existsSync(join(home, '.agents')), false);
  assert.equal(existsSync(join(home, '.figma-steroids')), false);
});
