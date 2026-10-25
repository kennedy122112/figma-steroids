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

if (errors.length) {
  console.error(`✗ ${errors.length} problema(s):\n` + errors.map((e) => `  - ${e}`).join('\n'));
  process.exit(1);
}
console.log('✓ Skills, agentes y manifiestos válidos');
