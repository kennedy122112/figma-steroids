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
  if (!entry) errors.push(`.claude-plugin/marketplace.json: no lista el plugin "${plugin.name}"`);
  else if (entry.version !== plugin.version) {
    errors.push(`versiones distintas: .claude-plugin/plugin.json ${plugin.version} vs .claude-plugin/marketplace.json ${entry.version}`);
  }
  if (pkg && pkg.version !== plugin.version) {
    errors.push(`versiones distintas: .claude-plugin/plugin.json ${plugin.version} vs package.json ${pkg.version}`);
  }
}

// Manifiesto portable Agent Plugins (Codex y formato abierto de Cursor).
// Reglas de https://agent-plugins.org/schemas/1.0.0/plugin.schema.json
const portable = readJson('plugin.json');
if (portable) {
  const SCHEMA = 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json';
  const allowed = ['$schema', 'name', 'version', 'description', 'author', 'homepage', 'repository', 'license', 'keywords', 'extensions'];
  if (portable.$schema !== SCHEMA) errors.push(`plugin.json: "$schema" debe ser ${SCHEMA}`);
  if (!/^(?!.*(?:--|\.\.))[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(portable.name || '') || portable.name.length > 64) {
    errors.push(`plugin.json: "name" no cumple el patrón de Agent Plugins`);
  }
  for (const k of Object.keys(portable)) if (!allowed.includes(k)) errors.push(`plugin.json: campo no permitido por Agent Plugins "${k}"`);
  for (const k of Object.keys(portable.author || {})) {
    if (!['name', 'email', 'url'].includes(k)) errors.push(`plugin.json: "author.${k}" no está permitido`);
  }
}

// Manifiesto de Cursor: name en kebab-case (puede llevar puntos); descubre skills/ y agents/ por defecto.
const cursor = readJson('.cursor-plugin/plugin.json');
if (cursor && !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(cursor.name || '')) {
  errors.push(`.cursor-plugin/plugin.json: "name" debe ir en kebab-case`);
}

// Marketplace de Codex.
const codexMarket = readJson('.agents/plugins/marketplace.json');
if (codexMarket) {
  const entry = codexMarket.plugins?.find((p) => p.name === plugin?.name);
  if (!entry) errors.push(`.agents/plugins/marketplace.json: no lista el plugin "${plugin?.name}"`);
  else {
    if (entry.source?.source !== 'local' || !entry.source?.path?.startsWith('./')) {
      errors.push(`.agents/plugins/marketplace.json: "source" debe ser { "source": "local", "path": "./…" }`);
    }
    if (!['AVAILABLE', 'INSTALLED_BY_DEFAULT', 'NOT_AVAILABLE'].includes(entry.policy?.installation)) {
      errors.push(`.agents/plugins/marketplace.json: "policy.installation" no es válido`);
    }
    if (!entry.category) errors.push(`.agents/plugins/marketplace.json: falta "category"`);
  }
}

// Plugin de Figma: manifiesto válido y archivos presentes. Figma rechaza 127.0.0.1 en
// devAllowedDomains, así que no se permite volver a ponerlo.
const figmaPlugin = readJson('figma-plugin/manifest.json');
if (figmaPlugin) {
  for (const k of ['name', 'id', 'api', 'main', 'ui']) {
    if (!figmaPlugin[k]) errors.push(`figma-plugin/manifest.json: falta "${k}"`);
  }
  for (const f of [figmaPlugin.main, figmaPlugin.ui].filter(Boolean)) {
    if (!existsSync(join(root, 'figma-plugin', f))) errors.push(`figma-plugin/manifest.json: no existe ${f}`);
  }
  const net = figmaPlugin.networkAccess || {};
  if (!Array.isArray(net.allowedDomains) || !net.allowedDomains.length) {
    errors.push('figma-plugin/manifest.json: networkAccess.allowedDomains debe tener al menos un valor');
  }
  if ((net.devAllowedDomains || []).some((d) => d.includes('127.0.0.1'))) {
    errors.push('figma-plugin/manifest.json: Figma no acepta 127.0.0.1 en devAllowedDomains');
  }
}

// Todas las versiones deben coincidir.
const versions = {
  'package.json': pkg?.version,
  '.claude-plugin/plugin.json': plugin?.version,
  'plugin.json': portable?.version,
  '.cursor-plugin/plugin.json': cursor?.version,
};
if (new Set(Object.values(versions)).size > 1) {
  errors.push(`versiones distintas: ${Object.entries(versions).map(([f, v]) => `${f} ${v}`).join(' · ')}`);
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
