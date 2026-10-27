#!/usr/bin/env node
// Convierte copias dibujadas a mano (botones, badges, inputs…) en un componente con variantes y
// sustituye cada copia por una instancia, en su sitio y con su texto.
//
//   node componentize.mjs --match badge --dry-run        qué haría, sin cambiar nada
//   node componentize.mjs --match badge --name Badge     crea el componente y sustituye las copias
//   node componentize.mjs --ids 16:2994,16:2996 --name Badge
//   [--page "<página>"]  buscar solo en esa página
//
// Las copias se agrupan por aspecto (alto, radio, relleno, borde, color y tamaño del texto): cada
// grupo es una variante. Una copia cuya estructura no coincide con la de su variante (un icono de
// más, otro número de textos) no se toca y sale en `skipped`.
//
// Va en tres fases (analizar, crear el componente, sustituir por lotes) porque el plugin corta cada
// llamada a los 25 s y figma-cli la reintenta: cada fase se puede repetir sin duplicar nada. Si ya
// existe un componente con ese nombre, se reutiliza y solo se le añaden las variantes que falten.
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const match = opt('--match');
const ids = (opt('--ids') || '').split(',').map((s) => s.trim()).filter(Boolean);
if (!match && !ids.length) {
  console.error('Uso: node componentize.mjs --match <nombre> | --ids <id,id> [--name <Componente>] [--page <página>] [--dry-run]');
  process.exit(1);
}
const name = opt('--name') || (match ? match[0].toUpperCase() + match.slice(1) : 'Componente');
const dryRun = args.includes('--dry-run');
const cli = process.env.FIGMA_CLI || 'figma-cli';
const BATCH = 8;

const dir = mkdtempSync(join(tmpdir(), 'fs-componentize-'));
let calls = 0;
// figma-cli eval devuelve lo que va tras el último ";": cada fase termina en "; JSON.stringify(…)".
function figmaEval(code) {
  const f = join(dir, `phase-${++calls}.js`);
  writeFileSync(f, code);
  let raw;
  try {
    raw = execSync(`${cli} eval -f "${f}"`, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1 << 26 });
  } catch (e) {
    raw = `${e.stdout || ""}${e.stderr || ""}`;
  }
  const json = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
  try {
    return JSON.parse(json);
  } catch {
    throw new Error(`figma-cli no devolvió lo esperado:\n${raw.slice(0, 2000)}`);
  }
}

const HELPERS = `
const hex = (c) => '#' + [c.r, c.g, c.b].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
const solid = (paints) => (Array.isArray(paints) ? paints.find((p) => p.type === 'SOLID' && p.visible !== false) : null);
const structure = (n) => n.type + ('children' in n ? '(' + n.children.map(structure).join(',') + ')' : '');
const texts = (n) => (n.type === 'TEXT' ? [n] : 'children' in n ? n.children.flatMap(texts) : []);
`;

// ---- Fase 1: analizar (solo lectura) ----
const analyze = `${HELPERS}
const MATCH = ${JSON.stringify(match || null)};
const IDS = ${JSON.stringify(ids)};
const ONLY_PAGE = ${JSON.stringify(opt('--page') || null)};
const insideInstanceOrComponent = (n) => { for (let p = n.parent; p && p.type !== 'PAGE'; p = p.parent) if (['INSTANCE', 'COMPONENT', 'COMPONENT_SET'].includes(p.type)) return true; return false; };
let found = [];
if (IDS.length) {
  for (const id of IDS) { const n = await figma.getNodeByIdAsync(id); if (n) found.push(n); }
} else {
  const re = new RegExp('\\\\b' + MATCH + '\\\\b', 'i');
  for (const p of figma.root.children) {
    if (ONLY_PAGE && p.name !== ONLY_PAGE) continue;
    await p.loadAsync();
    found.push(...p.findAll((n) => (n.type === 'FRAME' || n.type === 'GROUP') && re.test(n.name) && !insideInstanceOrComponent(n)));
  }
}
// Solo las más externas: una copia dentro de otra viaja con su padre.
const ids = new Set(found.map((n) => n.id));
found = found.filter((n) => { for (let p = n.parent; p && p.type !== 'PAGE'; p = p.parent) if (ids.has(p.id)) return false; return true; });

const colorVars = [];
for (const v of await figma.variables.getLocalVariablesAsync('COLOR')) {
  const val = Object.values(v.valuesByMode)[0];
  if (val && 'r' in val) colorVars.push({ name: v.name.split('/').pop(), hex: hex(val) });
}
async function colorName(node) {
  const b = node.boundVariables && node.boundVariables.fills && node.boundVariables.fills[0];
  if (b) { const v = await figma.variables.getVariableByIdAsync(b.id); if (v) return v.name.split('/').pop(); }
  const f = solid(node.fills);
  if (!f) return 'sin-relleno';
  const h = hex(f.color);
  const exact = colorVars.find((c) => c.hex === h);
  return exact ? exact.name : h.slice(1);
}
const groups = new Map();
for (const n of found) {
  const f = solid(n.fills), s = solid(n.strokes), t = texts(n)[0];
  const tf = t ? solid(t.fills) : null;
  const sig = [Math.round(n.height), typeof n.cornerRadius === 'number' ? n.cornerRadius : 'mixto', f ? hex(f.color) : '-', s ? hex(s.color) : '-',
    tf ? hex(tf.color) : '-', t && t.fontSize !== figma.mixed ? t.fontSize : '-', t && t.fontName !== figma.mixed ? t.fontName.style : '-'].join('|');
  if (!groups.has(sig)) groups.set(sig, { sig, nodes: [], template: n });
  groups.get(sig).nodes.push(n);
}
// Nombre de cada variante: su color (la variable si la tiene). Si varias comparten color, se
// distinguen por lo que cambia: sin texto → "icono", si no, el tamaño del texto; y si no, un número.
const extraOf = (n) => { const t = texts(n)[0]; return !t ? 'icono' : t.fontSize !== figma.mixed ? String(t.fontSize) : String(Math.round(n.height)); };
const variants = [];
for (const g of groups.values()) variants.push({ ...g, base: await colorName(g.template) });
const used = new Set();
for (const v of variants) {
  const shared = variants.filter((o) => o.base === v.base).length > 1;
  const stem = shared ? v.base + '-' + extraOf(v.template) : v.base;
  let name = stem, k = 2;
  while (used.has(name)) name = stem + '-' + k++;
  used.add(name);
  v.variant = name;
};
JSON.stringify({ candidates: found.length, variants: variants.map((v) => ({ variant: v.variant, count: v.nodes.length, look: v.sig, template: v.template.id, structure: structure(v.template), nodes: v.nodes.map((n) => n.id) })) })`;

// ---- Fase 2: crear el componente, o completar el que ya existe ----
const create = (variants) => `${HELPERS}
const NAME = ${JSON.stringify(name)};
const VARIANTS = ${JSON.stringify(variants.map((v) => ({ variant: v.variant, template: v.template })))};
const page = figma.root.children.find((p) => /design system|component|sistema/i.test(p.name)) || figma.currentPage;
await page.loadAsync();
let set = page.children.find((c) => c.type === 'COMPONENT_SET' && c.name === NAME);
const right = page.children.filter((c) => c !== set).reduce((m, c) => Math.max(m, c.x + c.width), 0);
const comps = {}, fresh = [];
for (const v of VARIANTS) {
  const existing = set && set.children.find((c) => c.name === 'variant=' + v.variant);
  if (existing) { comps[v.variant] = existing.id; continue; }
  const template = await figma.getNodeByIdAsync(v.template);
  if (!template) continue;
  const clone = template.clone();
  page.appendChild(clone);
  for (const k of ['layoutSizingHorizontal', 'layoutSizingVertical']) if (k in clone && clone[k] === 'FILL') clone[k] = 'FIXED';
  const c = figma.createComponentFromNode(clone);
  c.name = 'variant=' + v.variant;
  comps[v.variant] = c.id;
  fresh.push(c);
}
if (!set && fresh.length) {
  set = figma.combineAsVariants(fresh, page);
  set.name = NAME;
  set.x = right + 200; set.y = 0;
  set.layoutMode = 'HORIZONTAL'; set.itemSpacing = 24;
  set.paddingTop = set.paddingBottom = set.paddingLeft = set.paddingRight = 24;
  set.primaryAxisSizingMode = 'AUTO'; set.counterAxisSizingMode = 'AUTO';
} else if (set) for (const c of fresh) set.appendChild(c);
figma.commitUndo();
JSON.stringify({ set: set ? set.id : null, page: page.name, created: fresh.length, comps })`;

// ---- Fase 3: sustituir un lote de copias por instancias ----
const replace = (items) => `${HELPERS}
const ITEMS = ${JSON.stringify(items)};
let replaced = 0; const skipped = [];
for (const it of ITEMS) {
  const orig = await figma.getNodeByIdAsync(it.id);
  if (!orig) continue; // ya sustituida en una pasada anterior
  if (structure(orig) !== it.structure) { skipped.push({ id: orig.id, name: orig.name, reason: 'estructura distinta a la variante' }); continue; }
  const comp = await figma.getNodeByIdAsync(it.comp);
  const parent = orig.parent, index = parent.children.indexOf(orig);
  const inst = comp.createInstance();
  parent.insertChild(index, inst);
  if (!('layoutMode' in parent) || parent.layoutMode === 'NONE' || orig.layoutPositioning === 'ABSOLUTE') {
    if (orig.layoutPositioning === 'ABSOLUTE') inst.layoutPositioning = 'ABSOLUTE';
    inst.x = orig.x; inst.y = orig.y;
  } else {
    inst.layoutAlign = orig.layoutAlign; inst.layoutGrow = orig.layoutGrow;
  }
  try { inst.layoutSizingHorizontal = orig.layoutSizingHorizontal; inst.layoutSizingVertical = orig.layoutSizingVertical; } catch (e) {}
  if (orig.layoutSizingHorizontal === 'FIXED' || orig.layoutSizingVertical === 'FIXED') inst.resize(orig.width, orig.height);
  const from = texts(orig), to = texts(inst);
  for (let i = 0; i < Math.min(from.length, to.length); i++) {
    if (to[i].characters === from[i].characters) continue;
    await figma.loadFontAsync(to[i].fontName);
    to[i].characters = from[i].characters;
  }
  inst.name = orig.name;
  orig.remove();
  replaced++;
}
figma.commitUndo();
JSON.stringify({ replaced, skipped })`;

try {
  const plan = figmaEval(analyze);
  const summary = plan.variants.map(({ nodes, structure, ...v }) => v);
  if (dryRun || !plan.candidates) {
    console.log(JSON.stringify({ dryRun: true, name, candidates: plan.candidates, variants: summary }, null, 2));
  } else {
    const made = figmaEval(create(plan.variants));
    const items = plan.variants.flatMap((v) => v.nodes.map((id) => ({ id, comp: made.comps[v.variant], structure: v.structure }))).filter((it) => it.comp);
    let replaced = 0;
    const skipped = [];
    for (let i = 0; i < items.length; i += BATCH) {
      const r = figmaEval(replace(items.slice(i, i + BATCH)));
      replaced += r.replaced;
      skipped.push(...r.skipped);
    }
    console.log(JSON.stringify({ dryRun: false, name, componentSet: made.set, page: made.page, variantsCreated: made.created, variants: summary, replaced, skipped }, null, 2));
  }
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  rmSync(dir, { recursive: true, force: true });
}
