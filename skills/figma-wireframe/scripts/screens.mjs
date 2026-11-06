#!/usr/bin/env node
// De la idea a wireframes: construye pantallas a partir de un JSON con las piezas del kit
// (kit.mjs), las coloca en fila en el orden del flujo, escribe debajo a dónde lleva cada una y
// crea los enlaces de prototipo (clic en un botón → otra pantalla).
//
//   node screens.mjs pantallas.json
//
// pantallas.json:
// {
//   "device": "mobile" | "desktop",              (390×844 o 1440×900)
//   "flow": "Asistencia",                         (nombre del prototipo)
//   "screens": [
//     { "id": "inicio", "name": "2 · Inicio",
//       "top": { "kit": "Barra superior", "texts": ["‹", "Asistencia", "?"] },
//       "body": [ …nodos… ],
//       "bottom": { "kit": "Pestañas" },
//       "links": [ { "on": "Marcar entrada", "to": "verificando" } ] }
//   ]
// }
// Nodos del cuerpo:
//   { "text": "Hola, Ana", "size": 24, "muted": true, "align": "center" }
//   { "kit": "Botón principal", "texts": ["Marcar entrada"], "fill": true }   (fill = ancho completo)
//   { "kit": "Imagen", "h": 160, "fill": true }
//   { "row": [ …nodos… ], "gap": 8, "justify": "between", "fill": true }
//   { "col": [ …nodos… ], "gap": 8, "p": 16, "card": true }                 (card = caja con borde)
//   Filas y columnas dentro de una columna ocupan el ancho; "hug": true las deja a su tamaño.
//   { "spacer": true }                                                        (empuja lo siguiente al final)
// Cada pantalla es una llamada a Figma (el plugin corta a los 25 s). Repetirlo rehace las pantallas
// con el mismo nombre; el kit se reutiliza.
import { readFileSync } from 'node:fs';
import { figmaEval, FIGMA_HELPERS } from './lib.mjs';
import { KIT_CODE } from './kit.mjs';

const file = process.argv[2];
if (!file) {
  console.error('Uso: node screens.mjs pantallas.json');
  process.exit(1);
}
const spec = JSON.parse(readFileSync(file, 'utf8'));
const size = spec.device === 'desktop' ? { w: 1440, h: 900 } : { w: 390, h: 844 };
const GAP = 160;

const { kit } = figmaEval(KIT_CODE);

const buildScreen = (screen, index) => `${FIGMA_HELPERS}
const KIT = ${JSON.stringify(kit)};
const S = ${JSON.stringify(screen)};
const W = ${size.w}, H = ${size.h}, X = ${index * (size.w + GAP)};
const page = figma.currentPage;
for (const old of page.children.filter((c) => c.name === S.name)) old.remove();
const missing = [];

async function setTexts(node, texts) {
  const list = node.findAll((n) => n.type === 'TEXT');
  for (let i = 0; i < Math.min(texts.length, list.length); i++) {
    if (texts[i] == null) continue;
    await figma.loadFontAsync(list[i].fontName);
    list[i].characters = String(texts[i]);
  }
}
async function build(n, parent) {
  let node;
  if (n.kit) {
    const comp = KIT[n.kit] && await figma.getNodeByIdAsync(KIT[n.kit]);
    if (!comp) { missing.push(n.kit); return; }
    node = comp.createInstance();
    parent.appendChild(node);
    if (n.texts) await setTexts(node, n.texts);
    if (n.h && n.kit === 'Imagen') node.resize(node.width, n.h);
  } else if (n.text != null) {
    node = txt(String(n.text), n.size || 15, { muted: n.muted, align: n.align === 'center' ? 'CENTER' : undefined });
    parent.appendChild(node);
  } else if (n.row || n.col) {
    node = box(n.name || (n.row ? 'fila' : 'columna'), n.row ? 'row' : 'col', { gap: n.gap ?? 8, p: n.p ?? (n.card ? 16 : 0), justify: n.justify, items: n.items || (n.row ? 'center' : 'start'), fill: n.card ? P.paper : undefined, radius: n.card ? 10 : 0 });
    parent.appendChild(node);
    for (const c of n.row || n.col) await build(c, node);
  } else if (n.spacer) {
    node = figma.createFrame(); node.name = 'espacio'; node.fills = []; node.resize(1, 1);
    parent.appendChild(node);
    node.layoutGrow = 1;
    return;
  } else return;
  // Ancho completo: en una columna, ocupa el ancho; en una fila, reparte el espacio. Las filas,
  // columnas y textos de cuerpo dentro de una columna ocupan el ancho salvo "hug": true.
  const wide = (n.row || n.col || (n.text != null && (n.size || 15) <= 16)) && parent.layoutMode === 'VERTICAL' && !n.hug;
  if (n.fill || wide) {
    if (parent.layoutMode === 'VERTICAL') node.layoutSizingHorizontal = 'FILL'; else node.layoutGrow = 1;
    if (node.type === 'TEXT') node.textAutoResize = 'HEIGHT';
  }
  if (n.kit === 'Imagen' && n.h) { try { node.layoutSizingVertical = 'FIXED'; node.resize(node.width, n.h); } catch (e) {} }
  return node;
}

const scr = box(S.name, 'col', { fill: P.paper });
scr.primaryAxisSizingMode = 'FIXED'; scr.counterAxisSizingMode = 'FIXED'; scr.resize(W, H);
scr.counterAxisAlignItems = 'MIN'; scr.clipsContent = true;
page.appendChild(scr);
scr.x = X; scr.y = 0;
if (S.top) { const t = await build(S.top, scr); if (t) t.layoutSizingHorizontal = 'FILL'; }
const body = box('contenido', 'col', { gap: S.gap ?? 16, p: 20, items: 'start' });
scr.appendChild(body);
body.layoutSizingHorizontal = 'FILL'; body.layoutGrow = 1;
for (const n of S.body || []) await build(n, body);
if (S.bottom) { const b = await build(S.bottom, scr); if (b) b.layoutSizingHorizontal = 'FILL'; }
figma.commitUndo();
JSON.stringify({ id: scr.id, missing })`;

const built = {};
for (const [i, s] of spec.screens.entries()) {
  const r = figmaEval(buildScreen(s, i));
  built[s.id] = r.id;
  console.error(`✓ ${s.name}${r.missing.length ? ' (faltan en el kit: ' + r.missing.join(', ') + ')' : ''}`);
}

// Enlaces de prototipo, flechas entre pantallas vecinas y "lleva a" debajo de cada una.
const links = spec.screens.flatMap((s) => (s.links || []).map((l) => ({ from: built[s.id], to: built[l.to], on: l.on, toName: (spec.screens.find((x) => x.id === l.to) || {}).name })));
const flowCode = `${FIGMA_HELPERS}
const LINKS = ${JSON.stringify(links)};
const ORDER = ${JSON.stringify(spec.screens.map((s) => built[s.id]))};
const FLOW = ${JSON.stringify(spec.flow || 'Flujo')};
const page = figma.currentPage;
for (const old of page.children.filter((c) => c.name === '__flujo')) old.remove();
const deco = figma.createFrame(); deco.name = '__flujo'; deco.fills = []; deco.clipsContent = false; page.appendChild(deco);
let linked = 0; const unlinked = [];
const notes = {};
for (const l of LINKS) {
  const from = await figma.getNodeByIdAsync(l.from), to = l.to && await figma.getNodeByIdAsync(l.to);
  if (!from || !to) { unlinked.push(l.on + ' (pantalla destino no encontrada)'); continue; }
  (notes[l.from] = notes[l.from] || []).push(l.on + ' → ' + l.toName);
  const label = from.findOne((n) => n.type === 'TEXT' && n.characters.trim() === l.on);
  if (!label) { unlinked.push(l.on + ' (no hay un texto así en la pantalla)'); continue; }
  // El clic va en el botón o la fila que contiene el texto, no en el texto.
  let target = label;
  for (let p = label.parent; p && p !== from; p = p.parent) { if (p.type === 'INSTANCE' || p.type === 'FRAME') { target = p; break; } }
  try {
    await target.setReactionsAsync([{ trigger: { type: 'ON_CLICK' }, actions: [{ type: 'NODE', destinationId: to.id, navigation: 'NAVIGATE', transition: null, preserveScrollPosition: false }] }]);
    linked++;
  } catch (e) { unlinked.push(l.on + ' (' + e.message + ')'); }
  // Flecha si la pantalla destino es la siguiente en la fila.
  const i = ORDER.indexOf(l.from);
  if (ORDER[i + 1] === l.to) {
    const y = from.y + 80, x1 = from.x + from.width + 16, x2 = to.x - 16;
    const a = figma.createVector(); a.name = 'flecha';
    a.vectorPaths = [{ windingRule: 'NONE', data: 'M 0 0 L ' + (x2 - x1) + ' 0 M ' + (x2 - x1 - 10) + ' -7 L ' + (x2 - x1) + ' 0 L ' + (x2 - x1 - 10) + ' 7' }];
    a.strokes = [solid(P.ink)]; a.strokeWeight = 2; deco.appendChild(a); a.x = x1; a.y = y;
  }
}
for (const id of ORDER) {
  const s = await figma.getNodeByIdAsync(id);
  if (!s || !notes[id]) continue;
  const t = txt('Lleva a:\\n' + notes[id].join('\\n'), 14, { muted: true, name: 'lleva a' });
  deco.appendChild(t); t.x = s.x; t.y = s.y + s.height + 24;
  t.resize(s.width, t.height); t.textAutoResize = 'HEIGHT';
}
deco.resize(1, 1);
if (ORDER[0]) page.flowStartingPoints = [{ nodeId: ORDER[0], name: FLOW }];
figma.commitUndo();
JSON.stringify({ linked, unlinked })`;

const flow = figmaEval(flowCode);
console.log(JSON.stringify({ screens: built, prototypeLinks: flow.linked, notLinked: flow.unlinked }, null, 2));
