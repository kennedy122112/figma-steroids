// Valida skills, agentes y manifiestos del plugin. Sin dependencias.
// Uso: npm run validate
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const errors = [];
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function frontmatter(file) {
  const text = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const match = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return null;
  const fields = {};
  for (const line of match[1].split('\n')) {
    const kv = line.match(/^([a-zA-Z_-]+):\s*(.*)$/);
    if (kv) fields[kv[1]] = kv[2].trim();
  }
  return { fields, body: match[2] };
}

function checkEntry(file, expectedName, kind) {
  const fm = frontmatter(file);
  if (!fm) return errors.push(`${file}: falta el bloque frontmatter (--- ... ---)`);
  const { name, description } = fm.fields;
  if (!name) errors.push(`${file}: falta "name"`);
  else if (!KEBAB.test(name)) errors.push(`${file}: "name" debe ir en kebab-case (${name})`);
  else if (name !== expectedName) errors.push(`${file}: "name" (${name}) no coincide con el ${kind} (${expectedName})`);
  if (!description) errors.push(`${file}: falta "description"`);
  else if (description.length < 40) errors.push(`${file}: "description" es muy corta; di qué hace y cuándo usarla`);
  else if (description.length > 1024) errors.push(`${file}: "description" supera 1024 caracteres`);
  if (fm.body.trim().length < 50) errors.push(`${file}: el cuerpo está casi vacío`);
}

const skillsDir = join(root, 'skills');
for (const dir of readdirSync(skillsDir)) {
  const path = join(skillsDir, dir);
  if (!statSync(path).isDirectory()) continue;
  const file = join(path, 'SKILL.md');
  if (!existsSync(file)) errors.push(`${path}: falta SKILL.md`);
  else checkEntry(file, dir, 'nombre de la carpeta');

  // Adaptadores de stack: cada uno debe estar enlazado desde su SKILL.md y tener las secciones básicas.
  const stacksDir = join(path, 'stacks');
  if (!existsSync(stacksDir)) continue;
  const skillText = existsSync(file) ? readFileSync(file, 'utf8') : '';
  for (const f of readdirSync(stacksDir).filter((f) => f.endsWith('.md'))) {
    const stackFile = join(stacksDir, f);
    const text = readFileSync(stackFile, 'utf8');
    if (!/^# Adaptador: /m.test(text)) errors.push(`${stackFile}: debe empezar con "# Adaptador: <stack>"`);
    if (!/^## Detección/m.test(text)) errors.push(`${stackFile}: falta la sección "## Detección"`);
    if (!skillText.includes(`stacks/${f}`)) errors.push(`${stackFile}: no está enlazado en la tabla de ${dir}/SKILL.md`);
  }
}

const agentsDir = join(root, 'agents');
for (const f of readdirSync(agentsDir).filter((f) => f.endsWith('.md'))) {
  checkEntry(join(agentsDir, f), basename(f, '.md'), 'nombre del archivo');
}

function readJson(rel) {
  try {
    return JSON.parse(readFileSync(join(root, rel), 'utf8'));
  } catch (e) {
    errors.push(`${rel}: JSON inválido (${e.message})`);
    return null;
  }
}

const plugin = readJson('.claude-plugin/plugin.json');
const market = readJson('.claude-plugin/marketplace.json');
const pkg = readJson('package.json');
if (plugin && market) {
  const entry = market.plugins?.find((p) => p.name === plugin.name);
  if (!entry) errors.push(`marketplace.json: no lista el plugin "${plugin.name}"`);
  else if (entry.version !== plugin.version) {
    errors.push(`versiones distintas: plugin.json ${plugin.version} vs marketplace.json ${entry.version}`);
  }
  if (pkg && pkg.version !== plugin.version) {
    errors.push(`versiones distintas: plugin.json ${plugin.version} vs package.json ${pkg.version}`);
  }
}

// platforms.json: cada plataforma debe tener rutas de skills y un formato de agentes conocido.
const platformsFile = readJson('platforms.json');
if (platformsFile) {
  const { AGENT_FORMATS } = await import('../lib/installer.mjs');
  for (const [id, p] of Object.entries(platformsFile.platforms || {})) {
    if (!KEBAB.test(id)) errors.push(`platforms.json: el id "${id}" debe ir en kebab-case`);
    if (!p.label) errors.push(`platforms.json/${id}: falta "label"`);
    if (!Array.isArray(p.docs) || !p.docs.length) errors.push(`platforms.json/${id}: añade en "docs" la documentación donde verificaste las rutas`);
    if (!p.skills?.project || !p.skills?.global) errors.push(`platforms.json/${id}: "skills" necesita "project" y "global"`);
    if (p.agents && !AGENT_FORMATS[p.agents.format]) {
      errors.push(`platforms.json/${id}: formato de agentes desconocido "${p.agents.format}" (disponibles: ${Object.keys(AGENT_FORMATS).join(', ')})`);
    }
  }
}

if (errors.length) {
  console.error(`✗ ${errors.length} problema(s):\n` + errors.map((e) => `  - ${e}`).join('\n'));
  process.exit(1);
}
console.log('✓ Skills, agentes y manifiestos válidos');
