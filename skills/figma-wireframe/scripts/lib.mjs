// Ayudas compartidas de los scripts de wireframe: ejecutar código en Figma con figma-cli.
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';

const cli = process.env.FIGMA_CLI || 'figma-cli';

// Ejecuta código de la Plugin API y devuelve el objeto JSON que el código deja al final.
// figma-cli eval devuelve lo que va tras el último ";": el código debe terminar en "; JSON.stringify(…)".
// Cada llamada tiene 25 s como máximo (límite del plugin): reparte el trabajo en llamadas cortas.
export function figmaEval(code) {
  const dir = mkdtempSync(join(tmpdir(), 'fs-wf-'));
  try {
    const f = join(dir, 'code.js');
    writeFileSync(f, code);
    let raw;
    try {
      raw = execSync(`${cli} eval -f "${f}"`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 26 });
    } catch (e) {
      raw = `${e.stdout || ''}${e.stderr || ''}`;
    }
    const json = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
    try {
      return JSON.parse(json);
    } catch {
      throw new Error(`figma-cli no devolvió lo esperado:\n${raw.slice(0, 2000)}`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// Paleta del aspecto Wire Box en gris (la misma que wireframe.mjs).
export const PALETTE = { ink: '#4b5563', paper: '#ffffff', soft: '#f3f4f6' };

// Ayudas que se inyectan al principio del código que corre en Figma.
export const FIGMA_HELPERS = `
const P = ${JSON.stringify(PALETTE)};
const rgb = (h) => ({ r: parseInt(h.slice(1, 3), 16) / 255, g: parseInt(h.slice(3, 5), 16) / 255, b: parseInt(h.slice(5, 7), 16) / 255 });
const solid = (h, opacity = 1) => ({ type: 'SOLID', color: rgb(h), opacity });
let FONT = null;
for (const f of [{ family: 'Roboto', style: 'Regular' }, { family: 'Inter', style: 'Regular' }]) {
  try { await figma.loadFontAsync(f); FONT = f; break; } catch (e) {}
}
function txt(chars, size = 14, opts = {}) {
  const t = figma.createText();
  t.fontName = FONT; t.fontSize = size; t.characters = chars;
  t.fills = [solid(P.ink, opts.muted ? 0.65 : 1)];
  if (opts.align) t.textAlignHorizontal = opts.align;
  t.name = opts.name || chars.slice(0, 30);
  return t;
}
function box(name, dir, o = {}) {
  const f = figma.createFrame();
  f.name = name;
  f.layoutMode = dir === 'row' ? 'HORIZONTAL' : 'VERTICAL';
  f.itemSpacing = o.gap ?? 0;
  f.paddingTop = f.paddingBottom = o.py ?? o.p ?? 0;
  f.paddingLeft = f.paddingRight = o.px ?? o.p ?? 0;
  f.primaryAxisSizingMode = 'AUTO'; f.counterAxisSizingMode = 'AUTO';
  f.counterAxisAlignItems = o.items === 'start' ? 'MIN' : o.items === 'end' ? 'MAX' : 'CENTER';
  if (o.justify === 'between') f.primaryAxisAlignItems = 'SPACE_BETWEEN';
  else if (o.justify === 'center') f.primaryAxisAlignItems = 'CENTER';
  f.fills = o.fill ? [solid(o.fill)] : [];
  if (o.stroke !== false && (o.stroke || o.fill)) { f.strokes = [solid(P.ink)]; f.strokeWeight = o.strokeWeight || 1; }
  if (o.radius) f.cornerRadius = o.radius;
  return f;
}
`;
