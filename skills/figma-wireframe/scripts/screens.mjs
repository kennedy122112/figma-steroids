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
// Cada pantalla es una llamada a Figma (el plugin corta a los 25 s) y se reintenta si falla.
// Repetirlo rehace las pantallas con el mismo nombre; el kit se reutiliza. Los enlaces se rehacen
// siempre al final, aunque alguna pantalla falle (rehacer una pantalla borra los enlaces que
// llegaban a ella), y se comprueba cuántos quedaron de verdad en Figma.
//
//   node screens.mjs pantallas.json --links-only   solo enlaces, flechas y notas, sin redibujar
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { figmaRun, FIGMA_HELPERS } from './lib.mjs';
import { KIT_CODE } from './kit.mjs';

const GAP = 160;
const sizeOf = (spec) => (spec.device === 'desktop' ? { w: 1440, h: 900 } : { w: 390, h: 844 });

// Reintenta una llamada a Figma: el plugin a veces corta la conexión o tarda más de la cuenta.
// Solo para llamadas idempotentes (rehacer una pantalla reemplaza la del mismo nombre).
export async function withRetry(fn, { attempts = 3, wait = 3000, log = () => {} } = {}) {
  let last;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (i < attempts) {
        log(`  intento ${i} falló (${String(e.message).split('\n')[0].slice(0, 120)}); se repite`);
        await new Promise((r) => setTimeout(r, wait));
      }
    }
  }
  throw last;
}

export const buildScreen = (screen, index, kit, size) => `${FIGMA_HELPERS}
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

// Enlaces de prototipo, flechas entre pantallas vecinas y "lleva a" debajo de cada una. Busca las
// pantallas por nombre en la página: funciona aunque alguna no se haya podido redibujar.
export const flowCode = (spec) => `${FIGMA_HELPERS}
const SCREENS = ${JSON.stringify(spec.screens.map((s) => ({ id: s.id, name: s.name, links: s.links || [] })))};
const FLOW = ${JSON.stringify(spec.flow || 'Flujo')};
const page = figma.currentPage;
const byKey = {};
for (const s of SCREENS) { const n = page.children.find((c) => c.name === s.name); if (n) byKey[s.id] = n; };
const missingScreens = SCREENS.filter((s) => !byKey[s.id]).map((s) => s.name);
for (const old of page.children.filter((c) => c.name === '__flujo')) old.remove();
const deco = figma.createFrame(); deco.name = '__flujo'; deco.fills = []; deco.clipsContent = false; page.appendChild(deco);
let linked = 0; const unlinked = [];
const notes = {};
// Los enlaces se agrupan por elemento: setReactionsAsync reemplaza todos los del nodo, así que
// dos enlaces desde el mismo botón deben ir en la misma llamada.
const pending = new Map();
const order = SCREENS.map((x) => x.id);
for (const s of SCREENS) {
  const from = byKey[s.id];
  for (const l of s.links) {
    const to = byKey[l.to];
    const toName = (SCREENS.find((x) => x.id === l.to) || {}).name || l.to;
    if (!from || !to) { unlinked.push(l.on + ' (falta la pantalla ' + (from ? toName : s.name) + ')'); continue; }
    (notes[from.id] = notes[from.id] || []).push(l.on + ' → ' + toName);
    const label = from.findOne((n) => n.type === 'TEXT' && n.characters.trim() === l.on);
    if (!label) { unlinked.push(l.on + ' (no hay un texto así en ' + s.name + ')'); continue; }
    // El clic va en el botón o la fila que contiene el texto, no en el texto.
    let target = label;
    for (let p = label.parent; p && p !== from; p = p.parent) { if (p.type === 'INSTANCE' || p.type === 'FRAME') { target = p; break; } }
    const list = pending.get(target) || [];
    list.push({ trigger: { type: 'ON_CLICK' }, actions: [{ type: 'NODE', destinationId: to.id, navigation: 'NAVIGATE', transition: null, preserveScrollPosition: false }] });
    pending.set(target, list);
    // Flecha si la pantalla destino es la siguiente en la fila.
    if (order[order.indexOf(s.id) + 1] === l.to) {
      const y = from.y + 80, x1 = from.x + from.width + 16, x2 = to.x - 16;
      const a = figma.createVector(); a.name = 'flecha';
      a.vectorPaths = [{ windingRule: 'NONE', data: 'M 0 0 L ' + (x2 - x1) + ' 0 M ' + (x2 - x1 - 10) + ' -7 L ' + (x2 - x1) + ' 0 L ' + (x2 - x1 - 10) + ' 7' }];
      a.strokes = [solid(P.ink)]; a.strokeWeight = 2; deco.appendChild(a); a.x = x1; a.y = y;
    }
  }
};
for (const [target, reactions] of pending) {
  try { await target.setReactionsAsync(reactions); linked += reactions.length; }
  catch (e) { unlinked.push(target.name + ' (' + e.message + ')'); }
};
for (const s of SCREENS) {
  const n = byKey[s.id];
  if (!n || !notes[n.id]) continue;
  const t = txt('Lleva a:\\n' + notes[n.id].join('\\n'), 14, { muted: true, name: 'lleva a' });
  deco.appendChild(t); t.x = n.x; t.y = n.y + n.height + 24;
  t.resize(n.width, t.height); t.textAutoResize = 'HEIGHT';
};
deco.resize(1, 1);
const first = SCREENS[0] && byKey[SCREENS[0].id];
// Figma crea solo un 'Flow 1' al añadir el primer enlace y no admite dos puntos de inicio en la
// misma pantalla: se sustituye cualquiera que ya tenga esa pantalla o ese nombre.
if (first) page.flowStartingPoints = [...(page.flowStartingPoints || []).filter((f) => f.name !== FLOW && f.nodeId !== first.id), { nodeId: first.id, name: FLOW }];
figma.commitUndo();
// Comprobación: los enlaces que de verdad quedaron en las pantallas.
let present = 0;
for (const n of Object.values(byKey)) for (const x of [n, ...n.findAll((m) => m.reactions && m.reactions.length)]) present += (x.reactions || []).length;
const screens = Object.fromEntries(Object.entries(byKey).map(([k, n]) => [k, n.id]));
JSON.stringify({ screens, linked, present, unlinked, missingScreens })`;

export async function buildFlow(spec, { linksOnly = false, log = () => {}, retry = {} } = {}) {
  const failed = [];
  if (!linksOnly) {
    const size = sizeOf(spec);
    const { kit } = await withRetry(() => figmaRun(KIT_CODE), { ...retry, log });
    for (const [i, s] of spec.screens.entries()) {
      try {
        const r = await withRetry(() => figmaRun(buildScreen(s, i, kit, size)), { ...retry, log });
        log(`✓ ${s.name}${r.missing.length ? ' (faltan en el kit: ' + r.missing.join(', ') + ')' : ''}`);
      } catch (e) {
        failed.push(s.name);
        log(`✗ ${s.name}: ${String(e.message).split('\n')[0]}`);
      }
    }
  }
  // Los enlaces se hacen siempre, aunque alguna pantalla haya fallado: rehacer una pantalla borra
  // los enlaces que llegaban a ella y, sin este paso, el prototipo quedaría roto.
  const flow = await withRetry(() => figmaRun(flowCode(spec)), { ...retry, log });
  const expected = spec.screens.reduce((n, s) => n + (s.links || []).length, 0);
  return { screens: flow.screens, prototypeLinks: flow.linked, verifiedLinks: flow.present, expectedLinks: expected, notLinked: flow.unlinked, failedScreens: failed, missingScreens: flow.missingScreens };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith('--'));
  if (!file) {
    console.error('Uso: node screens.mjs pantallas.json [--links-only]');
    process.exit(1);
  }
  const spec = JSON.parse(readFileSync(file, 'utf8'));
  try {
    const r = await buildFlow(spec, { linksOnly: args.includes('--links-only'), log: (m) => console.error(m) });
    console.log(JSON.stringify(r, null, 2));
    if (r.failedScreens.length || r.missingScreens.length || r.verifiedLinks < r.expectedLinks) {
      console.error(`Atención: ${r.failedScreens.length ? 'no se pudieron dibujar ' + r.failedScreens.join(', ') + '. ' : ''}${r.verifiedLinks} de ${r.expectedLinks} enlaces quedaron en Figma (${r.notLinked.length} con problema). Revísalo y vuelve a ejecutarlo.`);
      process.exitCode = 1;
    }
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
