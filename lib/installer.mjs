// Instala las skills y agentes de figma-steroids en el formato de cada herramienta.
// La fuente de verdad es skills/ y agents/; las rutas de cada herramienta, platforms.json.
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, rmSync, cpSync, statSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

export const PKG_ROOT = fileURLToPath(new URL('..', import.meta.url));
export const MARKER_FILE = '.figma-steroids';
const MD_MARKER = '<!-- instalado por figma-steroids -->';
const TOML_MARKER = '# instalado por figma-steroids';
const BLOCK_START = '<!-- figma-steroids:start -->';
const BLOCK_END = '<!-- figma-steroids:end -->';

export function loadPlatforms() {
  return JSON.parse(readFileSync(join(PKG_ROOT, 'platforms.json'), 'utf8')).platforms;
}

export function version() {
  return JSON.parse(readFileSync(join(PKG_ROOT, 'package.json'), 'utf8')).version;
}

// FIGMA_STEROIDS_HOME permite probar instalaciones globales sin tocar la carpeta real del usuario.
function home() {
  return process.env.FIGMA_STEROIDS_HOME || homedir();
}

function resolvePath(p, scope, cwd) {
  if (scope === 'global') return p.startsWith('~/') ? join(home(), p.slice(2)) : p;
  return join(cwd, p);
}

export function parseFrontmatter(text) {
  const match = text.replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { fields: {}, body: text };
  const fields = {};
  for (const line of match[1].split('\n')) {
    const kv = line.match(/^([a-zA-Z_-]+):\s*(.*)$/);
    if (kv) fields[kv[1]] = kv[2].trim();
  }
  return { fields, body: match[2].replace(/^\n+/, '') };
}

export function readSource() {
  const skillsDir = join(PKG_ROOT, 'skills');
  const skills = readdirSync(skillsDir)
    .filter((d) => existsSync(join(skillsDir, d, 'SKILL.md')))
    .map((d) => ({ name: d, dir: join(skillsDir, d), ...parseFrontmatter(readFileSync(join(skillsDir, d, 'SKILL.md'), 'utf8')) }));
  const agentsDir = join(PKG_ROOT, 'agents');
  const agents = readdirSync(agentsDir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => ({ name: basename(f, '.md'), ...parseFrontmatter(readFileSync(join(agentsDir, f), 'utf8')) }));
  return { skills, agents };
}

const yamlString = (s) => JSON.stringify(s);
const toolList = (agent) => (agent.fields.tools || '').split(',').map((t) => t.trim()).filter(Boolean);
const canEditFiles = (agent) => toolList(agent).some((t) => ['Write', 'Edit', 'MultiEdit'].includes(t));

function tomlMultiline(text) {
  if (!text.includes("'''")) return `'''\n${text}'''`;
  return `"""\n${text.replace(/\\/g, '\\\\').replace(/"""/g, '\\"\\"\\"')}"""`;
}

// Un conversor por formato de agente. Para añadir un formato, añade una entrada aquí
// y úsala desde platforms.json.
export const AGENT_FORMATS = {
  'claude-md': {
    ext: '.md',
    render: (a) =>
      `---\nname: ${a.name}\ndescription: ${a.fields.description}\n` +
      (a.fields.tools ? `tools: ${a.fields.tools}\n` : '') +
      `---\n\n${a.body.trimEnd()}\n\n${MD_MARKER}\n`,
  },
  'cursor-md': {
    ext: '.md',
    render: (a) =>
      `---\nname: ${a.name}\ndescription: ${yamlString(a.fields.description)}\nmodel: inherit\n---\n\n` +
      `${a.body.trimEnd()}\n\n${MD_MARKER}\n`,
  },
  'opencode-md': {
    ext: '.md',
    render: (a) =>
      `---\ndescription: ${yamlString(a.fields.description)}\nmode: subagent\npermission:\n` +
      `  edit: ${canEditFiles(a) ? 'allow' : 'deny'}\n  bash: allow\n---\n\n` +
      `${a.body.trimEnd()}\n\n${MD_MARKER}\n`,
  },
  'codex-toml': {
    ext: '.toml',
    render: (a) =>
      `${TOML_MARKER}\nname = ${JSON.stringify(a.name.replace(/-/g, '_'))}\n` +
      `description = ${JSON.stringify(a.fields.description)}\n` +
      `developer_instructions = ${tomlMultiline(a.body.trimEnd() + '\n')}\n`,
  },
};

function firstSentence(text) {
  const s = text.split(/(?<=\.)\s/)[0];
  return s.length > 220 ? s.slice(0, 217) + '…' : s;
}

// includeRoles: true cuando alguna herramienta que lee este archivo no tiene subagentes.
export function instructionsBlock(includeRoles, { skills, agents }) {
  const lines = [
    BLOCK_START,
    '## figma-steroids',
    '',
    'Diseño en Figma Desktop con figma-cli, conectado por el plugin FigCli (modo Safe): sin API key ni MCP.',
    'Si `figma-cli` no está en el PATH, usa `npx -p figma-ds-cli figma-cli`.',
    '',
    'Skills disponibles (cárgalas cuando la tarea coincida):',
    ...skills.map((s) => `- \`${s.name}\`: ${firstSentence(s.fields.description)}`),
  ];
  if (includeRoles) {
    // Sin subagentes en esa herramienta: los agentes se describen como roles.
    lines.push('', 'Roles (adóptalos cuando la tarea lo pida):');
    for (const a of agents) lines.push('', `### ${a.name}`, '', a.fields.description, '', a.body.trim());
  }
  lines.push(BLOCK_END);
  return lines.join('\n');
}

function upsertBlock(file, block, dryRun) {
  const current = existsSync(file) ? readFileSync(file, 'utf8') : '';
  const re = new RegExp(`${BLOCK_START}[\\s\\S]*?${BLOCK_END}`);
  const next = re.test(current) ? current.replace(re, block) : (current ? current.trimEnd() + '\n\n' : '') + block + '\n';
  if (!dryRun) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, next);
  }
}

function removeBlock(file, dryRun) {
  if (!existsSync(file)) return false;
  const current = readFileSync(file, 'utf8');
  const re = new RegExp(`\\n*${BLOCK_START}[\\s\\S]*?${BLOCK_END}\\n?`);
  if (!re.test(current)) return false;
  const next = current.replace(re, '\n').trim();
  if (!dryRun) next ? writeFileSync(file, next + '\n') : rmSync(file);
  return true;
}

// Borra carpetas vacías desde dir hacia arriba, sin pasar de stopAt (el proyecto o la carpeta del usuario).
function pruneEmpty(dir, stopAt) {
  while (dir.startsWith(stopAt) && dir !== stopAt && existsSync(dir) && readdirSync(dir).length === 0) {
    rmSync(dir, { recursive: true });
    dir = dirname(dir);
  }
}

function isOurs(path) {
  if (!existsSync(path)) return true;
  if (statSync(path).isDirectory()) return existsSync(join(path, MARKER_FILE));
  const text = readFileSync(path, 'utf8');
  return text.includes(MD_MARKER) || text.includes(TOML_MARKER);
}

// Devuelve la lista de acciones ({ action, path }) realizadas o, con dryRun, previstas.
export function install(platformId, { scope = 'project', cwd = process.cwd(), dryRun = false, force = false } = {}) {
  const platforms = loadPlatforms();
  const platform = platforms[platformId];
  if (!platform) throw new Error(`Plataforma desconocida: ${platformId}`);
  const source = readSource();
  const actions = [];

  const skillsRoot = resolvePath(platform.skills[scope], scope, cwd);
  for (const skill of source.skills) {
    const target = join(skillsRoot, skill.name);
    if (!force && !isOurs(target)) {
      actions.push({ action: 'omitida (ya existe y no es de figma-steroids; usa --force)', path: target });
      continue;
    }
    if (!dryRun) {
      rmSync(target, { recursive: true, force: true });
      cpSync(skill.dir, target, { recursive: true });
      writeFileSync(join(target, MARKER_FILE), `${version()}\n`);
    }
    actions.push({ action: 'skill', path: target });
  }

  if (platform.agents && platform.agents[scope]) {
    const format = AGENT_FORMATS[platform.agents.format];
    const agentsRoot = resolvePath(platform.agents[scope], scope, cwd);
    for (const agent of source.agents) {
      const target = join(agentsRoot, agent.name + format.ext);
      if (!force && !isOurs(target)) {
        actions.push({ action: 'omitido (ya existe y no es de figma-steroids; usa --force)', path: target });
        continue;
      }
      if (!dryRun) {
        mkdirSync(agentsRoot, { recursive: true });
        writeFileSync(target, format.render(agent));
      }
      actions.push({ action: 'agente', path: target });
    }
  }

  const installed = [...new Set([...detectInstalled({ scope, cwd }), platformId])];
  const instr = platform.instructions && platform.instructions[scope];
  if (instr) {
    const target = resolvePath(instr, scope, cwd);
    upsertBlock(target, instructionsBlock(needsRoles(installed, target, scope, cwd), source), dryRun);
    actions.push({ action: 'instrucciones', path: target });
  }
  if (!dryRun) saveInstalled(installed, scope, cwd);
  return actions;
}

// Plataformas instaladas (de la lista) que usan este mismo archivo de instrucciones.
function sharingInstructions(ids, target, scope, cwd) {
  const platforms = loadPlatforms();
  return ids.filter((id) => {
    const p = platforms[id].instructions && platforms[id].instructions[scope];
    return p && resolvePath(p, scope, cwd) === target;
  });
}

function needsRoles(ids, target, scope, cwd) {
  const platforms = loadPlatforms();
  return sharingInstructions(ids, target, scope, cwd).some((id) => !platforms[id].agents);
}

export function uninstall(platformId, { scope = 'project', cwd = process.cwd(), dryRun = false } = {}) {
  const platforms = loadPlatforms();
  const platform = platforms[platformId];
  if (!platform) throw new Error(`Plataforma desconocida: ${platformId}`);
  const source = readSource();
  const actions = [];
  const remaining = detectInstalled({ scope, cwd }).filter((id) => id !== platformId);
  // Una carpeta compartida (p. ej. .agents/skills de Codex y universal) se conserva
  // mientras otra plataforma instalada la siga usando.
  const sharedBy = (pick, path) => remaining.some((id) => {
    const p = pick(platforms[id]);
    return p && resolvePath(p, scope, cwd) === path;
  });
  const remove = (path, kind) => {
    if (existsSync(path) && isOurs(path)) {
      if (!dryRun) rmSync(path, { recursive: true, force: true });
      actions.push({ action: `${kind} eliminado`, path });
    }
  };

  const skillsRoot = resolvePath(platform.skills[scope], scope, cwd);
  if (sharedBy((p) => p.skills[scope], skillsRoot)) {
    actions.push({ action: 'skills conservadas (las usa otra plataforma instalada)', path: skillsRoot });
  } else {
    for (const s of source.skills) remove(join(skillsRoot, s.name), 'skill');
  }

  if (platform.agents && platform.agents[scope]) {
    const ext = AGENT_FORMATS[platform.agents.format].ext;
    const agentsRoot = resolvePath(platform.agents[scope], scope, cwd);
    for (const a of source.agents) remove(join(agentsRoot, a.name + ext), 'agente');
  }

  const instr = platform.instructions && platform.instructions[scope];
  if (instr) {
    const target = resolvePath(instr, scope, cwd);
    if (sharingInstructions(remaining, target, scope, cwd).length) {
      upsertBlock(target, instructionsBlock(needsRoles(remaining, target, scope, cwd), source), dryRun);
      actions.push({ action: 'instrucciones actualizadas (las usa otra plataforma instalada)', path: target });
    } else if (removeBlock(target, dryRun)) {
      actions.push({ action: 'bloque de instrucciones eliminado', path: target });
    }
  }
  if (!dryRun) {
    saveInstalled(remaining, scope, cwd);
    const stopAt = scope === 'global' ? home() : cwd;
    pruneEmpty(skillsRoot, stopAt);
    if (platform.agents && platform.agents[scope]) pruneEmpty(resolvePath(platform.agents[scope], scope, cwd), stopAt);
  }
  return actions;
}

// Registro de plataformas instaladas: .figma-steroids.json en el proyecto o en la carpeta del usuario.
// Hace falta porque varias herramientas comparten carpetas (.agents/skills, AGENTS.md).
function statePath(scope, cwd) {
  return join(scope === 'global' ? home() : cwd, '.figma-steroids.json');
}

export function detectInstalled({ scope = 'project', cwd = process.cwd() } = {}) {
  const file = statePath(scope, cwd);
  if (!existsSync(file)) return [];
  return JSON.parse(readFileSync(file, 'utf8')).platforms || [];
}

function saveInstalled(ids, scope, cwd) {
  const file = statePath(scope, cwd);
  if (!ids.length) return rmSync(file, { force: true });
  writeFileSync(file, JSON.stringify({ version: version(), platforms: [...new Set(ids)].sort() }, null, 2) + '\n');
}
