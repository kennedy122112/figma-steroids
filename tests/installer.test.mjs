import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { install, uninstall, detectInstalled, loadPlatforms, readSource, AGENT_FORMATS, PKG_ROOT, installFigmaPlugin } from '../lib/installer.mjs';

let cwd;
let home;
beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), 'fs-proj-'));
  home = mkdtempSync(join(tmpdir(), 'fs-home-'));
  process.env.FIGMA_STEROIDS_HOME = home;
});
afterEach(() => {
  rmSync(cwd, { recursive: true, force: true });
  rmSync(home, { recursive: true, force: true });
  delete process.env.FIGMA_STEROIDS_HOME;
});

const { skills, agents } = readSource();
const platforms = loadPlatforms();
const expand = (p, scope) => (scope === 'global' ? join(home, p.replace(/^~\//, '')) : join(cwd, p));

for (const [id, p] of Object.entries(platforms)) {
  for (const scope of ['project', 'global']) {
    test(`${id} (${scope}): instala todas las skills, agentes e instrucciones`, () => {
      install(id, { scope, cwd });
      for (const s of skills) {
        assert.ok(existsSync(join(expand(p.skills[scope], scope), s.name, 'SKILL.md')), `falta ${s.name}`);
      }
      // Los adaptadores de figma-to-code viajan con la skill.
      assert.ok(existsSync(join(expand(p.skills[scope], scope), 'figma-to-code', 'stacks', 'angular.md')));
      // Y los scripts de apoyo de figma-from-code.
      assert.ok(existsSync(join(expand(p.skills[scope], scope), 'figma-from-code', 'scripts', 'dom-to-figma.js')));
      if (p.agents) {
        const ext = AGENT_FORMATS[p.agents.format].ext;
        for (const a of agents) assert.ok(existsSync(join(expand(p.agents[scope], scope), a.name + ext)));
      }
      const instr = p.instructions && p.instructions[scope];
      if (instr) assert.match(readFileSync(expand(instr, scope), 'utf8'), /figma-steroids:start/);
      assert.deepEqual(detectInstalled({ scope, cwd }), [id]);

      uninstall(id, { scope, cwd });
      for (const s of skills) assert.ok(!existsSync(join(expand(p.skills[scope], scope), s.name)));
      if (instr) assert.ok(!existsSync(expand(instr, scope)), 'el AGENTS.md vacío debe eliminarse');
      assert.deepEqual(detectInstalled({ scope, cwd }), []);
    });
  }
}

test('codex genera TOML con los campos obligatorios', () => {
  install('codex', { cwd });
  const toml = readFileSync(join(cwd, '.codex/agents/figma-ui-builder.toml'), 'utf8');
  assert.match(toml, /^name = "figma_ui_builder"$/m);
  assert.match(toml, /^description = ".+"$/m);
  assert.match(toml, /^developer_instructions = '''\n[\s\S]+'''$/m);
});

test('opencode: el revisor sin Write no puede editar, el guardián sí', () => {
  install('opencode', { cwd });
  const reviewer = readFileSync(join(cwd, '.opencode/agents/figma-design-reviewer.md'), 'utf8');
  const guardian = readFileSync(join(cwd, '.opencode/agents/figma-ds-guardian.md'), 'utf8');
  assert.match(reviewer, /mode: subagent/);
  assert.match(reviewer, /edit: deny/);
  assert.match(guardian, /edit: allow/);
});

test('respeta el AGENTS.md existente del usuario', () => {
  writeFileSync(join(cwd, 'AGENTS.md'), '# Mi proyecto\n\nReglas propias.\n');
  install('cursor', { cwd });
  install('cursor', { cwd }); // reinstalar no duplica el bloque
  const text = readFileSync(join(cwd, 'AGENTS.md'), 'utf8');
  assert.match(text, /^# Mi proyecto/);
  assert.equal(text.match(/figma-steroids:start/g).length, 1);
  uninstall('cursor', { cwd });
  assert.equal(readFileSync(join(cwd, 'AGENTS.md'), 'utf8'), '# Mi proyecto\n\nReglas propias.\n');
});

test('no pisa una skill del usuario con el mismo nombre salvo con --force', () => {
  const mine = join(cwd, '.cursor/skills/figma-connect');
  mkdirSync(mine, { recursive: true });
  writeFileSync(join(mine, 'SKILL.md'), 'mía');
  const actions = install('cursor', { cwd });
  assert.ok(actions.some((a) => a.action.startsWith('omitida')));
  assert.equal(readFileSync(join(mine, 'SKILL.md'), 'utf8'), 'mía');
  install('cursor', { cwd, force: true });
  assert.notEqual(readFileSync(join(mine, 'SKILL.md'), 'utf8'), 'mía');
});

test('carpetas compartidas: desinstalar codex conserva lo que usa universal', () => {
  install('codex', { cwd });
  install('universal', { cwd });
  assert.match(readFileSync(join(cwd, 'AGENTS.md'), 'utf8'), /Roles/, 'universal no tiene subagentes: necesita los roles');
  uninstall('codex', { cwd });
  assert.ok(existsSync(join(cwd, '.agents/skills/figma-connect/SKILL.md')));
  assert.ok(!existsSync(join(cwd, '.codex/agents/figma-ui-builder.toml')));
  assert.match(readFileSync(join(cwd, 'AGENTS.md'), 'utf8'), /figma-steroids:start/);
  uninstall('universal', { cwd });
  assert.ok(!existsSync(join(cwd, '.agents/skills/figma-connect')));
  assert.ok(!existsSync(join(cwd, 'AGENTS.md')));
});

test('plugin de Figma: se copia completo a una carpeta estable en la carpeta del usuario', () => {
  const manifest = installFigmaPlugin();
  assert.equal(manifest, join(home, '.figma-steroids', 'figma-plugin', 'manifest.json'));
  const data = JSON.parse(readFileSync(manifest, 'utf8'));
  for (const f of [data.main, data.ui]) assert.ok(existsSync(join(home, '.figma-steroids', 'figma-plugin', f)));
  // Repetirlo reemplaza la copia anterior sin errores.
  installFigmaPlugin();
  assert.ok(existsSync(manifest));
});

test('dry-run no escribe nada', () => {
  install('codex', { cwd, dryRun: true });
  assert.deepEqual(readdirSync(cwd), []);
});

test('CLI: init --ai all y uninstall', () => {
  const bin = join(PKG_ROOT, 'bin', 'figma-steroids.mjs');
  const out = execFileSync(process.execPath, [bin, 'init', '--ai', 'all'], { cwd, encoding: 'utf8' });
  assert.match(out, /Codex/);
  assert.deepEqual(detectInstalled({ cwd }), Object.keys(platforms).sort());
  execFileSync(process.execPath, [bin, 'uninstall'], { cwd, encoding: 'utf8' });
  assert.deepEqual(readdirSync(cwd), []);
});
