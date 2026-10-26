#!/usr/bin/env node
// CLI: instala las skills y agentes de figma-steroids en Claude Code, Codex, OpenCode, Cursor o el destino universal.
import { parseArgs } from 'node:util';
import { relative, join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { install, uninstall, detectInstalled, loadPlatforms, version, installFigmaPlugin } from '../lib/installer.mjs';

const HELP = `figma-steroids ${version()}

Uso:
  figma-steroids init --ai <plataformas> [--global] [--dry-run] [--force]
  figma-steroids update [--ai <plataformas>] [--global] [--dry-run]
  figma-steroids uninstall --ai <plataformas> [--global] [--dry-run]
  figma-steroids list
  figma-steroids plugin [--dry-run]   copia el plugin de Figma a una carpeta estable y muestra su manifiesto
  figma-steroids from-url <url> [--selector "main"] [--page "<página>"] [-c <colección>] [--dry-run]
                                      lleva a Figma una página de tu app (necesita playwright-core)

Plataformas: ${Object.keys(loadPlatforms()).join(', ')}, all
  Varias a la vez separadas por comas: --ai codex,cursor

Opciones:
  --global    instala en la carpeta del usuario (todos los proyectos) en vez del proyecto actual
  --dry-run   muestra qué haría sin escribir nada
  --force     sobrescribe skills o agentes con el mismo nombre que no son de figma-steroids
`;

// from-url tiene sus propias opciones: se pasan tal cual al script de la skill figma-from-code.
if (process.argv[2] === 'from-url') {
  const script = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'figma-from-code', 'scripts', 'from-url.mjs');
  const res = spawnSync(process.execPath, [script, ...process.argv.slice(3)], { stdio: 'inherit' });
  process.exit(res.status ?? 1);
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    ai: { type: 'string' },
    global: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
    force: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

const command = positionals[0];
const platforms = loadPlatforms();
const scope = values.global ? 'global' : 'project';
const opts = { scope, dryRun: values['dry-run'], force: values.force };

function selected() {
  if (!values.ai) return null;
  const ids = values.ai === 'all' ? Object.keys(platforms) : values.ai.split(',').map((s) => s.trim());
  const unknown = ids.filter((id) => !platforms[id]);
  if (unknown.length) {
    console.error(`Plataforma desconocida: ${unknown.join(', ')}. Disponibles: ${Object.keys(platforms).join(', ')}, all`);
    process.exit(1);
  }
  return ids;
}

function report(id, actions) {
  console.log(`\n${platforms[id].label}${opts.dryRun ? ' (simulación)' : ''}`);
  if (!actions.length) console.log('  (nada que hacer)');
  for (const a of actions) {
    const shown = scope === 'project' ? relative(process.cwd(), a.path) || a.path : a.path;
    console.log(`  ${a.action.padEnd(14)} ${shown}`);
  }
}

if (values.help || !command) {
  console.log(HELP);
  process.exit(0);
}

if (command === 'list') {
  for (const [id, p] of Object.entries(platforms)) {
    console.log(`${id.padEnd(10)} ${p.label}`);
    console.log(`${''.padEnd(10)} skills: ${p.skills.project} · ${p.skills.global}`);
    if (p.agents) console.log(`${''.padEnd(10)} agentes: ${p.agents.project} · ${p.agents.global} (${p.agents.format})`);
    if (p.instructions) console.log(`${''.padEnd(10)} instrucciones: ${[p.instructions.project, p.instructions.global].filter(Boolean).join(' · ')}`);
  }
  process.exit(0);
}

if (command === 'plugin') {
  const manifest = installFigmaPlugin({ dryRun: opts.dryRun });
  console.log(`Plugin de Figma figma-steroids${opts.dryRun ? ' (simulación)' : ''}:\n  ${manifest}\n`);
  console.log('En Figma Desktop: Plugins → Development → Import plugin from manifest… y elige ese archivo.');
  console.log('Después ábrelo con Plugins → Development → figma-steroids. Usa este plugin o FigCli, no los dos a la vez.');
  process.exit(0);
}

if (command === 'init' || command === 'update') {
  let ids = selected();
  if (!ids && command === 'update') ids = detectInstalled({ scope });
  if (!ids || !ids.length) {
    console.error(command === 'update'
      ? 'No encontré una instalación de figma-steroids aquí. Usa: figma-steroids init --ai <plataforma>'
      : 'Indica la plataforma con --ai (por ejemplo --ai codex, o --ai all).');
    process.exit(1);
  }
  for (const id of ids) report(id, install(id, opts));
  if (ids.includes('claude')) {
    console.log('\nNota: si ya instalaste el plugin de Claude Code (/plugin install), no hace falta también esta copia.');
  }
  console.log('\nSiguiente paso: abre el plugin FigCli en Figma (Plugins → Development → FigCli) y pide "conecta con Figma".');
  console.log('Opcional: `figma-steroids plugin` instala nuestro plugin de Figma, con registro de actividad y botón de pausa.');
  process.exit(0);
}

if (command === 'uninstall') {
  const ids = selected() || detectInstalled({ scope });
  if (!ids.length) {
    console.log('No hay nada de figma-steroids que desinstalar aquí.');
    process.exit(0);
  }
  for (const id of ids) report(id, uninstall(id, opts));
  process.exit(0);
}

console.error(`Comando desconocido: ${command}\n`);
console.log(HELP);
process.exit(1);
