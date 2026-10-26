// `figma-steroids setup`: todo lo que se puede automatizar para empezar, en Windows, macOS y Linux.
// Lo único que queda a mano es importar el plugin en Figma la primera vez (Figma no lo permite
// desde fuera); setup deja la ruta en el portapapeles y la carpeta abierta para que sea un pegar.
import { existsSync, readFileSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { PKG_ROOT, install, installFigmaPlugin } from './installer.mjs';

const home = () => process.env.FIGMA_STEROIDS_HOME || homedir();
const DAEMON_PORT = 3456;

// Herramientas de IA instaladas, por las carpetas de configuración que crean en tu usuario.
// Son las mismas en Windows, macOS y Linux (todas viven bajo la carpeta del usuario).
export const TOOL_DIRS = {
  claude: ['.claude'],
  codex: ['.codex'],
  opencode: ['.config/opencode', '.opencode'],
  cursor: ['.cursor'],
};

export function detectTools({ base = home() } = {}) {
  return Object.entries(TOOL_DIRS)
    .filter(([, dirs]) => dirs.some((d) => existsSync(join(base, d))))
    .map(([id]) => id);
}

// Si figma-steroids ya está instalado como plugin de Claude Code, instalar además las skills
// en ~/.claude las duplicaría.
export function hasClaudePlugin({ base = home() } = {}) {
  const file = join(base, '.claude', 'plugins', 'installed_plugins.json');
  try {
    return /figma-steroids@/.test(readFileSync(file, 'utf8'));
  } catch {
    return false;
  }
}

// Comandos para copiar al portapapeles y mostrar un archivo en el explorador, por sistema.
// Devuelven [ejecutable, argumentos] o null si no hay forma conocida.
export function clipboardCommand(platform = process.platform, has = commandExists) {
  if (platform === 'win32') return ['powershell', ['-NoProfile', '-Command', '$input | Set-Clipboard']];
  if (platform === 'darwin') return ['pbcopy', []];
  if (has('wl-copy')) return ['wl-copy', []];
  if (has('xclip')) return ['xclip', ['-selection', 'clipboard']];
  return null;
}

export function revealCommand(file, platform = process.platform) {
  if (platform === 'win32') return ['explorer', [`/select,"${file}"`]];
  if (platform === 'darwin') return ['open', ['-R', file]];
  return ['xdg-open', [dirname(file)]];
}

export function commandExists(cmd) {
  const probe = process.platform === 'win32' ? spawnSync('where', [cmd], { stdio: 'ignore' }) : spawnSync('sh', ['-c', `command -v ${cmd}`], { stdio: 'ignore' });
  return probe.status === 0;
}

// figma-cli: el del sistema si existe; si no, el que viene como dependencia de figma-steroids.
export function figmaCli() {
  if (commandExists('figma-cli')) return { cmd: 'figma-cli', args: [], global: true };
  try {
    const entry = createRequire(join(PKG_ROOT, 'package.json')).resolve('figma-ds-cli/src/index.js');
    return { cmd: process.execPath, args: [entry], global: false };
  } catch {
    return null;
  }
}

function copyToClipboard(text) {
  const c = clipboardCommand();
  if (!c) return false;
  const r = spawnSync(c[0], c[1], { input: text, stdio: ['pipe', 'ignore', 'ignore'] });
  return r.status === 0;
}

function reveal(file) {
  const [cmd, args] = revealCommand(file);
  try {
    // explorer necesita las comillas tal cual: Node no debe volver a escaparlas.
    spawn(cmd, args, { stdio: 'ignore', detached: true, windowsVerbatimArguments: process.platform === 'win32' }).unref();
    return true;
  } catch {
    return false;
  }
}

async function pluginConnected() {
  let token = '';
  try { token = readFileSync(join(homedir(), '.figma-ds-cli', '.daemon-token'), 'utf8').trim(); } catch {}
  try {
    const res = await fetch(`http://127.0.0.1:${DAEMON_PORT}/health`, { headers: token ? { 'X-Daemon-Token': token } : {} });
    const health = await res.json();
    return !!health.plugin;
  } catch {
    return false;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function setup({ ai, installCli = true, open = true, wait = 180, dryRun = false, log = console.log } = {}) {
  const ok = (m) => log(`  ✓ ${m}`);
  const warn = (m) => log(`  ! ${m}`);
  log(`\nfigma-steroids setup${dryRun ? ' (simulación)' : ''} · ${{ win32: 'Windows', darwin: 'macOS' }[process.platform] || 'Linux'}\n`);

  // 1. Node.js
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 18 || (major === 18 && minor < 17)) {
    warn(`Node.js ${process.versions.node}: hace falta 18.17 o superior (https://nodejs.org).`);
    return { ok: false };
  }
  ok(`Node.js ${process.versions.node}`);

  // 2. figma-cli
  let cli = figmaCli();
  if (cli && cli.global) ok('figma-cli instalado');
  else if (installCli && !dryRun) {
    log('  … instalando figma-cli (npm install -g figma-ds-cli)');
    const r = spawnSync('npm', ['install', '-g', 'figma-ds-cli'], { stdio: 'ignore', shell: process.platform === 'win32' });
    cli = figmaCli();
    if (r.status === 0 && cli && cli.global) ok('figma-cli instalado');
    else warn('No se pudo instalar figma-cli global (¿permisos?). Las skills usarán `npx -p figma-ds-cli figma-cli`.');
  } else warn(dryRun ? 'Instalaría figma-cli (npm install -g figma-ds-cli).' : 'figma-cli no está instalado: las skills usarán `npx -p figma-ds-cli figma-cli`.');

  // 3. Skills y agentes en cada herramienta de IA instalada
  let tools = ai || detectTools();
  if (!ai && tools.includes('claude') && hasClaudePlugin()) {
    tools = tools.filter((t) => t !== 'claude');
    ok('Claude Code: ya tienes el plugin figma-steroids');
  }
  if (!tools.length && !hasClaudePlugin()) tools = ['universal'];
  for (const id of tools) {
    install(id, { scope: 'global', dryRun, force: false });
    ok(`Skills y agentes en ${id === 'universal' ? '~/.agents (estándar Agent Skills)' : id}`);
  }

  // 4. Plugin de Figma
  const manifest = installFigmaPlugin({ dryRun });
  ok(`Plugin de Figma en ${manifest}`);
  if (!dryRun && open) {
    const copied = copyToClipboard(manifest);
    const shown = reveal(manifest);
    if (copied) ok('Ruta copiada al portapapeles');
    if (shown) ok('Carpeta del plugin abierta');
  }

  log(`
  Ahora, en Figma Desktop (solo la primera vez):
    1. Abre cualquier archivo de diseño.
    2. Plugins → Development → Import plugin from manifest…
    3. Pega la ruta${process.platform === 'darwin' ? ' (Cmd+Shift+G en el diálogo y Cmd+V)' : ' en el nombre de archivo (Ctrl+V)'} y abre el archivo.
    4. Plugins → Development → figma-steroids.
`);

  if (dryRun || !wait || !cli) return { ok: true, manifest, tools, connected: false };

  // 5. Arranca figma-cli en modo Safe y espera a que el plugin se conecte. Se lanza desde una
  // carpeta temporal: `figma-cli connect` escribe un AGENTS.md en la carpeta donde se ejecuta.
  const scratch = mkdtempSync(join(tmpdir(), 'figma-steroids-setup-'));
  // En Windows, figma-cli global es un .cmd: se lanza por la shell como una sola orden.
  const viaShell = cli.global && process.platform === 'win32';
  const child = viaShell
    ? spawn('figma-cli connect --safe', { cwd: scratch, stdio: 'ignore', detached: true, shell: true })
    : spawn(cli.cmd, [...cli.args, 'connect', '--safe'], { cwd: scratch, stdio: 'ignore', detached: true });
  child.unref();
  log(`  … esperando a que abras el plugin en Figma (hasta ${wait} s; Ctrl+C para salir)`);
  for (let s = 0; s < wait; s += 2) {
    await sleep(2000);
    if (await pluginConnected()) {
      ok(`Conectado con Figma (${s + 2} s). Ya puedes pedirle diseños a tu IA.\n`);
      return { ok: true, manifest, tools, connected: true };
    }
  }
  warn('El plugin no se conectó todavía. Cuando lo abras en Figma, dile a tu IA "conecta con Figma".\n');
  return { ok: true, manifest, tools, connected: false };
}
