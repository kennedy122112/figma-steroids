#!/usr/bin/env node
// CLI: instala las skills y agentes de figma-steroids en Claude Code, Codex, OpenCode, Cursor o el destino universal.
import { parseArgs } from 'node:util';
import { relative } from 'node:path';
import { install, uninstall, detectInstalled, loadPlatforms, version } from '../lib/installer.mjs';

const HELP = `figma-steroids ${version()}

Uso:
  figma-steroids init --ai <plataformas> [--global] [--dry-run] [--force]
  figma-steroids update [--ai <plataformas>] [--global] [--dry-run]
  figma-steroids uninstall --ai <plataformas> [--global] [--dry-run]
  figma-steroids list

Plataformas: ${Object.keys(loadPlatforms()).join(', ')}, all
  Varias a la vez separadas por comas: --ai codex,cursor

Opciones:
  --global    instala en la carpeta del usuario (todos los proyectos) en vez del proyecto actual
  --dry-run   muestra qué haría sin escribir nada
  --force     sobrescribe skills o agentes con el mismo nombre que no son de figma-steroids
`;

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
