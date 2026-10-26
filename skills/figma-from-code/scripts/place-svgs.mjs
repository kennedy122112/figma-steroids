#!/usr/bin/env node
// Dibuja como vector, dentro de su hueco, los iconos SVG del código que dom-to-figma no supo
// identificar (un logo propio, un icono que no está en lucide). render-tree.mjs lo llama al
// terminar; con una pantalla pequeña renderizada a mano se usa directamente:
//
//   node place-svgs.mjs resultado.json <id del frame raíz>
//
// resultado.json es la salida de dom-to-figma ({ jsx, tree, report, svgs }). Los huecos son
// frames llamados "__svg_slot_<n>"; el vector se mete dentro, el hueco toma el nombre del icono
// y queda sin relleno, del mismo tamaño que en la página.
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const SVG_SLOT = '__svg_slot_';

// Una sola llamada a Figma para todos los iconos. Devuelve { placed, missing }.
// figma-cli eval devuelve lo que va tras el último ";": por eso el "};" antes del resultado.
export function placeSvgs(svgs, rootId, { cli = process.env.FIGMA_CLI || 'figma-cli' } = {}) {
  if (!svgs || !svgs.length) return { placed: 0, missing: [] };
  const code = `
const root = await figma.getNodeByIdAsync(${JSON.stringify(rootId)});
const svgs = ${JSON.stringify(svgs)};
const slots = root.findAll((n) => n.type === 'FRAME' && n.name.startsWith(${JSON.stringify(SVG_SLOT)}));
let placed = 0; const missing = [];
for (const slot of slots) {
  const item = svgs[+slot.name.slice(${SVG_SLOT.length})];
  if (!item) continue;
  try {
    const v = figma.createNodeFromSvg(item.svg);
    v.name = 'svg';
    v.fills = [];
    v.resize(slot.width, slot.height);
    slot.layoutMode = 'NONE';
    slot.fills = [];
    slot.appendChild(v);
    v.x = 0; v.y = 0;
    slot.name = item.name;
    placed++;
  } catch (e) { missing.push(item.name + ': ' + e.message); slot.name = 'Icono (sin identificar)'; }
};
JSON.stringify({ placed, missing })`;
  const dir = mkdtempSync(join(tmpdir(), 'place-svgs-'));
  try {
    const f = join(dir, 'place.js');
    writeFileSync(f, code);
    const out = execSync(`${cli} eval -f "${f}"`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return JSON.parse(out.trim().split('\n').pop());
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [file, rootId] = process.argv.slice(2);
  if (!file || !rootId) {
    console.error('Uso: node place-svgs.mjs resultado.json <id del frame raíz>');
    process.exit(1);
  }
  const data = JSON.parse(readFileSync(file, 'utf8'));
  console.log(JSON.stringify(placeSvgs(data.svgs, rootId)));
}
