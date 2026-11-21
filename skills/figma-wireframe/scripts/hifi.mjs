#!/usr/bin/env node
// De wireframe a alta fidelidad: hace una copia de cada pantalla ("<pantalla> · Alta fidelidad",
// debajo de la original) y en la copia
//   - cambia cada pieza del kit de wireframe (instancias de WF/…) por el componente del design
//     system que le corresponde, con los mismos textos, el mismo ancho y los mismos enlaces;
//   - vincula los grises del wireframe a las variables del sistema (fondo, tarjeta, apagado, texto,
//     texto secundario, borde);
//   - aplica a cada texto el estilo de texto de tamaño más cercano;
//   - vincula espaciados y radios al token más cercano (a 4 px como mucho).
// Al final, los enlaces de prototipo entre copias apuntan a las copias, no a los wireframes.
//
//   node hifi.mjs --all                       todas las pantallas de wireframe de la página actual
//   node hifi.mjs --id "12:34" [--id …]       solo esas pantallas
//   node hifi.mjs --all --dry-run             solo el plan: qué componente y qué variable usará
//   node hifi.mjs --all --map mapa.json       elegir a mano piezas del kit:
//        { "Botón principal": "Button[Variant=Default]", "Fila": "List Item", "Imagen": null }
//
// Las pantallas originales no se tocan. Repetirlo rehace las copias. Cada pantalla es una llamada
// a Figma (el plugin corta a los 25 s).
import { readFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { figmaRun } from './lib.mjs';

export const SUFFIX = ' · Alta fidelidad';

// Qué componentes del design system sirven para cada pieza del kit (por nombre) y, si son un
// conjunto de variantes, qué variante buscar.
export const KIT_RULES = {
  'Botón principal': { name: '\\b(button|bot[oó]n|btn)\\b', variant: 'primary|principal|default|filled|solid' },
  Botón: { name: '\\b(button|bot[oó]n|btn)\\b', variant: 'secondary|secundario|outline|ghost' },
  Campo: { name: '\\b(input|campo|text ?field|textfield|field)\\b' },
  Tarjeta: { name: '\\b(card|tarjeta)\\b' },
  Fila: { name: '\\b(list ?item|list ?row|row|fila|item)\\b' },
  Chip: { name: '\\b(badge|chip|tag|pill)\\b' },
  Avatar: { name: '\\bavatar\\b' },
  'Barra superior': { name: '\\b(app ?bar|top ?bar|header|nav ?bar|navbar|toolbar)\\b' },
  Pestañas: { name: '\\b(tab ?bar|bottom ?nav(igation)?|tabs|pestañas)\\b' },
  Imagen: { name: '\\b(image|imagen|placeholder)\\b' },
  'Visor de cámara': { name: '\\b(camera|c[aá]mara)\\b' },
};

// Papel de cada variable de color, por el final de su nombre ("color/muted-foreground" → muted-foreground).
export const ROLES = {
  background: '^(background|bg|base)$',
  card: '^(card|surface|surface-?1|paper)$',
  muted: '^(muted|secondary|surface-?2|subtle|accent)$',
  foreground: '^(foreground|text|fg|on-?background|text-?primary)$',
  mutedForeground: '^(muted-?foreground|text-?muted|text-?secondary|subtle-?foreground|secondary-?foreground)$',
  border: '^(border|stroke|outline|divider)$',
};

// Fase 1: el plan (componentes, variables, estilos y, con --all, las pantallas).
export function planCode({ map = {}, ids = [], all = false }) {
  return `
const RULES = ${JSON.stringify(KIT_RULES)};
const ROLES = ${JSON.stringify(ROLES)};
const OVERRIDE = ${JSON.stringify(map)};
const IDS = ${JSON.stringify(ids)};
const ALL = ${!!all};

// ---- Componentes del design system (sin el kit de wireframe) ----
const comps = [];
for (const p of figma.root.children) {
  await p.loadAsync();
  for (const c of p.findAllWithCriteria({ types: ['COMPONENT', 'COMPONENT_SET'] })) {
    if (c.type === 'COMPONENT' && c.parent && c.parent.type === 'COMPONENT_SET') continue;
    if (/^WF\\//.test(c.name)) continue;
    comps.push(c);
  }
};
const props = (k) => Object.fromEntries(k.name.split(',').map((s) => s.split('=').map((x) => x.trim().toLowerCase())).filter((x) => x.length === 2));
function pickVariant(set, vre, want) {
  if (set.type !== 'COMPONENT_SET') return { node: set, exact: true };
  const kids = set.children.filter((k) => k.type === 'COMPONENT');
  if (want) {
    const k = kids.find((k) => Object.entries(want).every(([p, v]) => props(k)[p.toLowerCase()] === String(v).toLowerCase()));
    return k ? { node: k, exact: true } : null;
  }
  const score = (k) => (vre && vre.test(k.name) ? 10 : 0)
    + (/size\\s*=\\s*(default|md|medium|m)\\b/i.test(k.name) || !/size\\s*=/i.test(k.name) ? 2 : 0)
    - (/disabled|hover|pressed|focus|loading|active/i.test(k.name) ? 5 : 0);
  let best = set.defaultVariant || kids[0], bs = -Infinity;
  for (const k of kids) { const s = score(k); if (s > bs) { bs = s; best = k; } }
  return { node: best, exact: !vre || vre.test(best.name) };
}
const kit = {};
for (const [piece, rule] of Object.entries(RULES)) {
  let found = null;
  if (piece in OVERRIDE) {
    const o = OVERRIDE[piece];
    if (o) {
      const m = String(o).match(/^(.*?)\\s*(?:\\[(.*)\\])?$/);
      const want = m[2] ? Object.fromEntries(m[2].split(',').map((s) => s.split('=').map((x) => x.trim()))) : null;
      const c = comps.find((c) => c.name.toLowerCase() === m[1].toLowerCase()) || comps.find((c) => c.name.split('/').pop().toLowerCase() === m[1].toLowerCase());
      found = c && pickVariant(c, null, want);
      if (!found) { kit[piece] = { error: 'no encuentro ' + o }; continue; }
    }
  } else {
    const re = new RegExp(rule.name, 'i');
    const cands = comps.filter((c) => re.test(c.name.split('/').pop()) && !/icon|icono/i.test(c.name));
    // El nombre más corto suele ser el componente base ("Button" antes que "Button Group").
    cands.sort((a, b) => a.name.split('/').pop().length - b.name.split('/').pop().length);
    if (cands.length) found = pickVariant(cands[0], rule.variant ? new RegExp(rule.variant, 'i') : null);
  }
  kit[piece] = found ? { id: found.node.id, label: found.node.parent && found.node.parent.type === 'COMPONENT_SET' ? found.node.parent.name + ' (' + found.node.name + ')' : found.node.name, exact: found.exact } : null;
};

// ---- Variables de color por papel (sin las colecciones de tema oscuro) ----
const darkCols = new Set((await figma.variables.getLocalVariableCollectionsAsync()).filter((c) => /dark|oscuro/i.test(c.name)).map((c) => c.id));
const allVars = (await figma.variables.getLocalVariablesAsync()).filter((v) => !darkCols.has(v.variableCollectionId));
const norm = (s) => s.toLowerCase().replace(/[\\s_]+/g, '-');
const vars = {};
for (const [role, src] of Object.entries(ROLES)) {
  const re = new RegExp(src);
  const colors = allVars.filter((v) => v.resolvedType === 'COLOR');
  const v = colors.find((v) => re.test(norm(v.name.split('/').pop())))
    || colors.find((v) => re.test(norm(v.name.split('/').slice(-2).join('-'))));
  vars[role] = v ? { id: v.id, name: v.name } : null;
};
// Paletas por escala ("color/neutral/0…900") en vez de nombres por función: los papeles que falten
// se eligen entre los grises por su luminosidad (el más claro, fondo; el más oscuro, texto…).
if (Object.values(vars).some((v) => !v)) {
  const resolveVal = async (v, d = 0) => { const val = Object.values(v.valuesByMode)[0]; if (val && val.type === 'VARIABLE_ALIAS' && d < 5) { const t = await figma.variables.getVariableByIdAsync(val.id); return t ? resolveVal(t, d + 1) : null; } return val; };
  let greys = [];
  for (const v of allVars.filter((v) => v.resolvedType === 'COLOR')) {
    const c = await resolveVal(v);
    if (!c || !('r' in c) || (c.a ?? 1) < 0.99) continue;
    greys.push({ v, l: 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b, spread: Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b) });
  }
  // Por nombre si la paleta dice cuáles son los neutros (los "slate" son grises algo azulados);
  // si no, los colores casi sin saturación.
  const named = greys.filter((g) => /neutral|gr[ae]y|slate|zinc|stone|gris/i.test(g.v.name));
  greys = named.length >= 3 ? named : greys.filter((g) => g.spread <= 0.15);
  greys.sort((a, b) => b.l - a.l);
  const closest = (lo, hi, target, not = []) => greys.filter((g) => g.l > lo && g.l <= hi && !not.includes(g)).sort((a, b) => Math.abs(a.l - target) - Math.abs(b.l - target))[0];
  const light = greys[0] && greys[0].l > 0.95 ? greys[0] : null;
  const dark = greys.length && greys[greys.length - 1].l < 0.25 ? greys[greys.length - 1] : null;
  const pickByValue = {
    background: light, card: light,
    muted: closest(0.85, 0.99, 0.95, [light]),
    border: closest(0.65, 0.92, 0.82, [light]),
    foreground: dark,
    mutedForeground: closest(0.2, 0.65, 0.4, [dark]),
  };
  for (const [role, g] of Object.entries(pickByValue)) if (!vars[role] && g) vars[role] = { id: g.v.id, name: g.v.name, byValue: true };
};
const firstVal = (v) => Object.values(v.valuesByMode)[0];
const floats = allVars.filter((v) => v.resolvedType === 'FLOAT' && typeof firstVal(v) === 'number');
const spacing = floats.filter((v) => /spac|gap|space|padding/i.test(v.name)).map((v) => ({ id: v.id, value: firstVal(v) }));
const radius = floats.filter((v) => /radius|round|corner/i.test(v.name)).map((v) => ({ id: v.id, value: firstVal(v) }));
const styles = (await figma.getLocalTextStylesAsync()).map((s) => ({ id: s.id, name: s.name, size: s.fontSize, font: s.fontName }));

// ---- Pantallas ----
const isWF = async (n) => n.type === 'INSTANCE' && (await n.getMainComponentAsync())?.name?.startsWith('WF/');
const screens = [];
const cands = ALL ? figma.currentPage.children.filter((c) => c.type === 'FRAME' && !c.name.endsWith(${JSON.stringify(SUFFIX)}) && c.name !== 'Kit de wireframe' && c.name !== '__flujo')
  : (await Promise.all(IDS.map((id) => figma.getNodeByIdAsync(id)))).filter(Boolean);
for (const s of cands) {
  let wf = 0;
  for (const i of s.findAll((n) => n.type === 'INSTANCE')) if (await isWF(i)) wf++;
  if (ALL && !wf) continue;
  screens.push({ id: s.id, name: s.name, x: s.x, wfPieces: wf });
};
screens.sort((a, b) => a.x - b.x);
JSON.stringify({ kit, vars, spacing, radius, styles, screens })`;
}

// Fase 2: una pantalla.
export function screenCode({ id, plan }) {
  return `
const ID = ${JSON.stringify(id)};
const SUFFIX = ${JSON.stringify(SUFFIX)};
const KIT = ${JSON.stringify(plan.kit)};
const VARS = ${JSON.stringify(plan.vars)};
const SPACING = ${JSON.stringify(plan.spacing)};
const RADIUS = ${JSON.stringify(plan.radius)};
const STYLES = ${JSON.stringify(plan.styles)};
const report = { swapped: {}, kept: {}, fills: 0, strokes: 0, texts: 0, spacing: 0, radius: 0, errors: [] };
const bump = (o, k) => { o[k] = (o[k] || 0) + 1; };
const reactionsOf = (n) => (n.reactions || []).map((r) => ({ trigger: r.trigger, actions: r.actions || (r.action ? [r.action] : []) }));

const src = await figma.getNodeByIdAsync(ID);
if (!src) throw new Error('No existe la pantalla ' + ID);
const name = src.name + SUFFIX;
for (const old of src.parent.children.filter((c) => c.name === name)) old.remove();
const copy = src.clone();
copy.name = name;
src.parent.appendChild(copy);
copy.x = src.x; copy.y = src.y + src.height + 300;

// ---- Piezas del kit → componentes del sistema ----
const mainName = async (n) => ((await n.getMainComponentAsync()) || {}).name || '';
for (const inst of copy.findAll((n) => n.type === 'INSTANCE')) {
  if (inst.removed) continue;
  let nested = false;
  for (let p = inst.parent; p && p !== copy; p = p.parent) if (p.type === 'INSTANCE') { nested = true; break; }
  if (nested) continue;
  const main = await mainName(inst);
  if (!main.startsWith('WF/')) continue;
  const piece = main.slice(3);
  const target = KIT[piece] && KIT[piece].id && await figma.getNodeByIdAsync(KIT[piece].id);
  if (!target) { bump(report.kept, piece); continue; }
  // Los textos de la pieza, sin los iconos dibujados con símbolos (‹ › ? × ≡…): solo los que tienen letras o números.
  const texts = inst.findAll((n) => n.type === 'TEXT').map((t) => t.characters).filter((s) => /[A-Za-z0-9\\u00C0-\\u024F]/.test(s));
  const parent = inst.parent;
  const ni = target.createInstance();
  parent.insertChild(parent.children.indexOf(inst), ni);
  if (parent.layoutMode && parent.layoutMode !== 'NONE') {
    try { if (inst.layoutSizingHorizontal === 'FILL') ni.layoutSizingHorizontal = 'FILL'; } catch (e) {}
    try { if (inst.layoutGrow) ni.layoutGrow = inst.layoutGrow; } catch (e) {}
  } else { ni.x = inst.x; ni.y = inst.y; }
  const slots = ni.findAll((n) => n.type === 'TEXT');
  for (let i = 0; i < Math.min(texts.length, slots.length); i++) {
    const t = slots[i];
    try {
      const fonts = t.characters.length ? t.getRangeAllFontNames(0, t.characters.length) : [t.fontName];
      for (const f of fonts) await figma.loadFontAsync(f);
      t.characters = texts[i];
    } catch (e) { report.errors.push(piece + ': ' + e.message); }
  }
  const rs = reactionsOf(inst);
  if (rs.length) { try { await ni.setReactionsAsync(rs); } catch (e) { report.errors.push('enlace en ' + piece + ': ' + e.message); } }
  inst.remove();
  bump(report.swapped, piece);
}

// ---- Grises del wireframe → variables; tamaños → estilos y tokens ----
const V = {};
for (const [role, v] of Object.entries(VARS)) V[role] = v && await figma.variables.getVariableByIdAsync(v.id);
const pick = (...roles) => roles.find((r) => V[r]);
const lum = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
const kind = (c) => (c.r > 0.99 && c.g > 0.99 && c.b > 0.99 ? 'paper' : lum(c) > 0.75 ? 'soft' : 'ink');
const bindPaint = (p, role) => figma.variables.setBoundVariableForPaint({ ...p, opacity: 1 }, 'color', V[role]);
const nearest = (list, val, max) => { let best = null; for (const t of list) if (!best || Math.abs(t.value - val) < Math.abs(best.value - val)) best = t; return best && Math.abs(best.value - val) <= max ? best : null; };
const varCache = {};
const getVar = async (id) => (varCache[id] = varCache[id] || await figma.variables.getVariableByIdAsync(id));

async function restyle(node, isRoot) {
  // Las instancias del sistema traen su propio estilo; solo se tocan las piezas del kit que quedaron.
  if (node.type === 'INSTANCE' && !(await mainName(node)).startsWith('WF/')) return;
  const b = node.boundVariables || {};
  if (Array.isArray(node.fills) && node.fills.length) {
    const fills = [...node.fills]; let changed = false;
    for (let i = 0; i < fills.length; i++) {
      const p = fills[i];
      if (p.type !== 'SOLID' || p.visible === false || (b.fills || [])[i]) continue;
      const k = kind(p.color);
      const role = node.type === 'TEXT' ? ((p.opacity ?? 1) < 0.9 ? pick('mutedForeground', 'foreground') : pick('foreground'))
        : k === 'paper' ? (isRoot ? pick('background', 'card') : node.strokes && node.strokes.length ? pick('card', 'background') : pick('background', 'card'))
        : k === 'soft' ? pick('muted', 'card', 'background') : pick('foreground');
      if (!role) continue;
      fills[i] = bindPaint(p, role); changed = true; report.fills++;
    }
    if (changed) node.fills = fills;
  }
  if (Array.isArray(node.strokes) && node.strokes.length) {
    const strokes = [...node.strokes]; let changed = false;
    for (let i = 0; i < strokes.length; i++) {
      const p = strokes[i];
      if (p.type !== 'SOLID' || p.visible === false || (b.strokes || [])[i]) continue;
      const role = node.type === 'FRAME' || node.type === 'RECTANGLE' ? pick('border', 'mutedForeground') : pick('mutedForeground', 'border', 'foreground');
      if (!role) continue;
      strokes[i] = bindPaint(p, role); changed = true; report.strokes++;
    }
    if (changed) node.strokes = strokes;
  }
  if (node.type === 'TEXT' && STYLES.length && !node.textStyleId && node.fontSize !== figma.mixed) {
    let best = null;
    for (const s of STYLES) {
      const d = Math.abs(s.size - node.fontSize);
      if (!best || d < best.d || (d === best.d && node.fontSize >= 20 && /bold|semi/i.test(s.font.style))) best = { s, d };
    }
    try { await figma.loadFontAsync(best.s.font); await node.setTextStyleIdAsync(best.s.id); report.texts++; } catch (e) { report.errors.push('estilo ' + best.s.name + ': ' + e.message); }
  }
  if ('layoutMode' in node && node.layoutMode && node.layoutMode !== 'NONE') {
    for (const k of ['itemSpacing', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft']) {
      const val = node[k];
      if (!val || val <= 0 || b[k] || (k === 'itemSpacing' && node.primaryAxisAlignItems === 'SPACE_BETWEEN')) continue;
      const t = nearest(SPACING, val, 4);
      if (t) { node.setBoundVariable(k, await getVar(t.id)); report.spacing++; }
    }
  }
  if (typeof node.cornerRadius === 'number' && node.cornerRadius > 0 && !b.topLeftRadius && node.type !== 'TEXT') {
    const circle = Math.abs(node.width - node.height) < 1 && node.cornerRadius >= node.width / 2 - 0.5;
    const t = !circle && nearest(RADIUS, node.cornerRadius, 4);
    if (t) { const v = await getVar(t.id); for (const k of ['topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius']) node.setBoundVariable(k, v); report.radius++; }
  }
  if ('children' in node) for (const c of node.children) await restyle(c, false);
}
await restyle(copy, true);
figma.commitUndo();
JSON.stringify({ id: copy.id, ...report })`;
}

// Fase 3: los enlaces entre pantallas apuntan a las copias, y el prototipo tiene su punto de inicio.
export function relinkCode(map) {
  return `
const MAP = ${JSON.stringify(map)};
const SUFFIX = ${JSON.stringify(SUFFIX)};
let relinked = 0;
for (const id of Object.values(MAP)) {
  const c = await figma.getNodeByIdAsync(id);
  if (!c) continue;
  for (const n of [c, ...c.findAll((n) => n.reactions && n.reactions.length)]) {
    if (!n.reactions || !n.reactions.length) continue;
    let changed = false;
    const next = n.reactions.map((r) => ({ trigger: r.trigger, actions: (r.actions || (r.action ? [r.action] : [])).map((a) => {
      if (a && a.destinationId && MAP[a.destinationId]) { changed = true; return { ...a, destinationId: MAP[a.destinationId] }; }
      return a;
    }) }));
    if (changed) { await n.setReactionsAsync(next); relinked++; }
  }
};
let page = (await figma.getNodeByIdAsync(Object.values(MAP)[0]));
while (page && page.type !== 'PAGE') page = page.parent;
if (page) {
  const sp = page.flowStartingPoints || [];
  const add = sp.filter((s) => MAP[s.nodeId]).map((s) => ({ nodeId: MAP[s.nodeId], name: s.name + SUFFIX }));
  if (add.length) page.flowStartingPoints = [...sp.filter((s) => !add.some((a) => a.name === s.name)), ...add];
};
figma.commitUndo();
JSON.stringify({ relinked })`;
}

export async function hifi({ ids = [], all = false, map = {}, dryRun = false, log = () => {} } = {}) {
  if (!all && !ids.length) throw new Error('Indica las pantallas con --id "<id>" o usa --all para todas las de la página.');
  const plan = await figmaRun(planCode({ map, ids, all }));
  const mapping = Object.fromEntries(Object.entries(plan.kit).map(([k, v]) => [k, v ? (v.error ? `✗ ${v.error}` : v.label + (v.exact ? '' : ' (sin la variante buscada)')) : null]));
  const tokens = Object.fromEntries(Object.entries(plan.vars).map(([k, v]) => [k, v && v.name + (v.byValue ? ' (por valor)' : '')]));
  const hasSystem = Object.values(plan.kit).some((v) => v && v.id) || Object.values(plan.vars).some(Boolean) || plan.styles.length;
  if (!hasSystem) throw new Error('Este archivo no tiene design system (componentes, variables o estilos de texto). Cárgalo primero con la skill figma-design-system.');
  const summary = { mapping, tokens, textStyles: plan.styles.length, spacingTokens: plan.spacing.length, radiusTokens: plan.radius.length, screens: plan.screens.map((s) => s.name) };
  if (!plan.screens.length) throw new Error(all ? 'No hay pantallas de wireframe (con piezas del kit WF/) en la página actual.' : 'No encuentro esas pantallas.');
  if (dryRun) return { dryRun: true, ...summary };

  const done = [];
  const idMap = {};
  for (const s of plan.screens) {
    log(`… ${s.name}`);
    const r = await figmaRun(screenCode({ id: s.id, plan }));
    idMap[s.id] = r.id;
    done.push({ name: s.name + SUFFIX, ...r });
  }
  const { relinked } = await figmaRun(relinkCode(idMap));
  return { ...summary, screens: done, prototypeLinks: relinked };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const args = process.argv.slice(2);
  const all = (name) => args.flatMap((a, i) => (a === name ? [args[i + 1]] : []));
  const mapArg = all('--map')[0];
  try {
    const map = mapArg ? JSON.parse(existsSync(mapArg) ? readFileSync(mapArg, 'utf8') : mapArg) : {};
    const r = await hifi({ ids: all('--id'), all: args.includes('--all'), map, dryRun: args.includes('--dry-run'), log: (m) => console.error(m) });
    console.log(JSON.stringify(r, null, 2));
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
