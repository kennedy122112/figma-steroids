#!/usr/bin/env node
// Pasa una pantalla a wireframe (baja fidelidad) sin perder la estructura: copia la pantalla a su
// derecha y cambia solo el aspecto. El auto-layout, los textos y las instancias se conservan, así
// que el wireframe sigue siendo editable. La original no se toca.
//
//   node wireframe.mjs --id 16:2789 [--look wirebox|suave] [--style gris|rosa|azul|verde|dorado|carbon|blueprint]
//
// Aspectos (--look):
// · wirebox (por defecto, el de Wire Box de Help Scout): todo en blanco con una línea de 1 px del
//   color del estilo (gris por defecto) en cada caja, círculo y forma; iconos solo en contorno;
//   textos del color del estilo, todos en Roboto Regular;
// · suave: cajas claras → papel y oscuras → gris suave, borde fino al 70 %, iconos rellenos y los
//   textos conservan su fuente y su peso.
// En los dos: sin sombras ni degradados, e imágenes → caja con una X.
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';

const STYLES = {
  gris: { ink: '#4b5563', paper: '#ffffff', soft: '#e5e7eb' },
  azul: { ink: '#2400ff', paper: '#ffffff', soft: '#e7e5ff' },
  blueprint: { ink: '#ffffff', paper: '#1e40af', soft: '#2f52c4' },
  rosa: { ink: '#dd00a9', paper: '#ffffff', soft: '#fbe5f6' },
  verde: { ink: '#026128', paper: '#ffffff', soft: '#e1efe6' },
  dorado: { ink: '#aa6600', paper: '#ffffff', soft: '#f6ecdd' },
  carbon: { ink: '#1f1f1f', paper: '#ffffff', soft: '#e8e8e8' },
};

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const id = opt('--id');
const look = opt('--look') || 'wirebox';
const style = opt('--style') || 'gris';
if (!id || !STYLES[style] || !['wirebox', 'suave'].includes(look)) {
  console.error(`Uso: node wireframe.mjs --id <id de la pantalla> [--look wirebox|suave] [--style ${Object.keys(STYLES).join('|')}]`);
  process.exit(1);
}
const cli = process.env.FIGMA_CLI || 'figma-cli';

const code = `
const S = ${JSON.stringify(STYLES[style])};
const STYLE = ${JSON.stringify(style)};
const WIREBOX = ${JSON.stringify(look === 'wirebox')};
const rgb = (h) => ({ r: parseInt(h.slice(1, 3), 16) / 255, g: parseInt(h.slice(3, 5), 16) / 255, b: parseInt(h.slice(5, 7), 16) / 255 });
const solid = (h, opacity = 1) => ({ type: 'SOLID', color: rgb(h), opacity });
const lum = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;

const src = await figma.getNodeByIdAsync(${JSON.stringify(id)});
const name = src.name + ' · Wireframe (' + STYLE + (WIREBOX ? '' : ', suave') + ')';
// Si ya existe (una pasada anterior), se rehace desde la original.
for (const old of src.parent.children.filter((c) => c.name === name)) old.remove();
const w = src.clone();
w.name = name;
src.parent.appendChild(w);
// A la derecha de todo lo que ya hay en la página, a la altura de la original.
const right = src.parent.children.filter((c) => c !== w).reduce((m, c) => Math.max(m, c.x + c.width), 0);
w.x = right + 120; w.y = src.y;

const count = { boxes: 0, texts: 0, icons: 0, images: 0 };
// Wire Box pone todos los textos en Roboto Regular; si no está, Inter Regular.
let FONT = null;
if (WIREBOX) {
  for (const f of [{ family: 'Roboto', style: 'Regular' }, { family: 'Inter', style: 'Regular' }]) {
    try { await figma.loadFontAsync(f); FONT = f; break; } catch (e) {}
  }
}
const ICON = ['VECTOR', 'BOOLEAN_OPERATION', 'STAR', 'LINE', 'POLYGON'];
const inInstance = (n) => { for (let p = n.parent; p && p !== w; p = p.parent) if (p.type === 'INSTANCE') return true; return false; };

async function visit(n, root) {
  if (n.visible === false) return;
  const fills = Array.isArray(n.fills) ? n.fills.filter((p) => p.visible !== false) : [];
  const strokes = Array.isArray(n.strokes) ? n.strokes.filter((p) => p.visible !== false) : [];
  if ('effects' in n && n.effects.length) n.effects = [];

  if (n.type === 'TEXT') {
    n.fills = [solid(S.ink)];
    if (FONT && n.characters.length) n.setRangeFontName(0, n.characters.length, FONT);
    count.texts++;
  } else if (ICON.includes(n.type)) {
    if (WIREBOX) {
      // Wire Box: el icono solo en contorno, línea de 1 px.
      n.fills = []; n.strokes = [solid(S.ink)]; n.strokeWeight = 1;
    } else {
      // Suave: conservan si eran de relleno o de trazo, en el color del estilo.
      if (fills.length) n.fills = [solid(S.ink)];
      if (strokes.length) n.strokes = [solid(S.ink)];
    }
    count.icons++;
  } else if ('fills' in n) {
    const image = fills.some((p) => p.type === 'IMAGE' || p.type === 'VIDEO');
    if (image) {
      n.fills = [solid(WIREBOX ? S.paper : S.soft)];
      n.strokes = [solid(S.ink, WIREBOX ? 1 : 0.6)]; n.strokeWeight = 1;
      // La X de los wireframes, como dos líneas que no afectan al auto-layout.
      if (n.type === 'FRAME' && !inInstance(n)) {
        for (const [x1, y1, x2, y2] of [[0, 0, n.width, n.height], [0, n.height, n.width, 0]]) {
          const l = figma.createVector();
          l.name = 'X';
          l.vectorPaths = [{ windingRule: 'NONE', data: 'M ' + x1 + ' ' + y1 + ' L ' + x2 + ' ' + y2 }];
          l.strokes = [solid(S.ink, 0.5)]; l.strokeWeight = 1;
          n.appendChild(l);
          if (n.layoutMode !== 'NONE') l.layoutPositioning = 'ABSOLUTE';
          l.x = 0; l.y = 0;
        }
      }
      count.images++;
    } else if (n === root) {
      n.fills = [solid(S.paper)];
      if (WIREBOX) { n.strokes = [solid(S.ink)]; n.strokeWeight = 1; }
    } else if (fills.length || strokes.length) {
      // Relleno oscuro (barras, botones, avatares) → gris suave; claro → papel. Todo con borde fino.
      const f = fills.find((p) => p.type === 'SOLID') || fills[0];
      const dark = f && f.type === 'SOLID' ? lum(f.color) * (f.opacity ?? 1) + (1 - (f.opacity ?? 1)) < 0.6 : f && f.type.startsWith('GRADIENT');
      n.fills = fills.length ? [solid(dark && !WIREBOX ? S.soft : S.paper)] : [];
      n.strokes = [solid(S.ink, WIREBOX ? 1 : 0.7)];
      if (typeof n.strokeWeight === 'number' && n.strokeWeight > 1.5) n.strokeWeight = 1;
      if (!strokes.length) n.strokeWeight = 1;
      count.boxes++;
    }
  }
  if ('children' in n) for (const c of n.children) await visit(c, root);
}
await visit(w, w);
figma.commitUndo();
const result = { id: w.id, name: w.name, look: WIREBOX ? 'wirebox' : 'suave', style: STYLE, font: FONT && FONT.family, ...count };
JSON.stringify(result)`;

const dir = mkdtempSync(join(tmpdir(), 'fs-wireframe-'));
try {
  const f = join(dir, 'wireframe.js');
  writeFileSync(f, code);
  let raw;
  try {
    raw = execSync(`${cli} eval -f "${f}"`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 26 });
  } catch (e) {
    raw = `${e.stdout || ''}${e.stderr || ''}`;
  }
  const json = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
  try {
    console.log(JSON.stringify(JSON.parse(json), null, 2));
  } catch {
    console.error(`figma-cli no devolvió lo esperado:\n${raw.slice(0, 2000)}`);
    process.exit(1);
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}
