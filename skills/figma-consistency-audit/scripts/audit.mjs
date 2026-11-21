#!/usr/bin/env node
// Auditoría de coherencia de un archivo de Figma completo: qué se sale del design system,
// agrupado por valor y con la variable o el estilo que debería usarse.
//
//   node audit.mjs                       informe de todo el archivo (JSON)
//   node audit.mjs --page "Pantallas"    solo esa página
//   node audit.mjs --fix                 además vincula lo que coincide EXACTAMENTE con el sistema
//   node audit.mjs --out informe.json    guarda el informe
//   node audit.mjs --batch 15            pantallas por llamada (por defecto 15)
//
// --fix nunca cambia el aspecto: solo vincula colores, espaciados y radios al token que ya tiene
// ese valor, y aplica el estilo de texto que ya coincide en fuente, tamaño, peso e interlineado.
//
// Trabaja por lotes (cada página, en grupos de pantallas de primer nivel) para no chocar con el
// corte de 25 s del plugin en archivos grandes, y une los resultados aquí. Repetir un lote con
// --fix es seguro: lo ya vinculado no se vuelve a tocar.
// Usa `figma-cli` del PATH; FIGMA_CLI="npx -p https://github.com/kennedy122112/figma-cli/archive/0ff87728992533b0a6c93a5fb7614c3cbc69c237.tar.gz figma-cli" lo cambia.
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { figmaEval, figmaEvalLarge, batches, mergeGroups, sumInto } from './lib.mjs';

// Lo que se calcula una sola vez para todo el archivo: los componentes (exige cargar todas las páginas).
const SYSTEM_CODE = `
const components = [];
for (const p of figma.root.children) {
  await p.loadAsync();
  p.findAllWithCriteria({ types: ['COMPONENT', 'COMPONENT_SET'] }).forEach((c) => {
    if (c.type === 'COMPONENT' && c.parent && c.parent.type === 'COMPONENT_SET') return;
    components.push(c.name);
  });
};
JSON.stringify({ file: figma.root.name, components })`;

// Código de un lote (Plugin API). Recalcula variables y estilos (es barato) y recorre solo `ids`.
function batchCode({ ids, pageName, fix, components }) {
  return `
const IDS = ${JSON.stringify(ids)};
const PAGE = ${JSON.stringify(pageName)};
const FIX = ${!!fix};
const components = ${JSON.stringify(components)};
const EXAMPLES = 5;
const hex = (c) => '#' + [c.r, c.g, c.b].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const dist = (a, b) => { const x = rgb(a), y = rgb(b); return Math.sqrt((x[0]-y[0])**2 + (x[1]-y[1])**2 + (x[2]-y[2])**2); };

// ---- El sistema: variables (resolviendo alias) y estilos de texto ----
const resolve = async (v, depth = 0) => {
  const val = Object.values(v.valuesByMode)[0];
  if (val && val.type === 'VARIABLE_ALIAS' && depth < 5) { const t = await figma.variables.getVariableByIdAsync(val.id); return t ? resolve(t, depth + 1) : null; }
  return val;
};
const colorVars = [], floatVars = [];
// Las colecciones de tema oscuro paralelas ("… · Dark") repiten nombres con otros valores: no sirven
// para decidir qué variable corresponde a un valor del diseño claro.
const darkCols = new Set((await figma.variables.getLocalVariableCollectionsAsync()).filter((c) => /dark|oscuro/i.test(c.name)).map((c) => c.id));
for (const v of await figma.variables.getLocalVariablesAsync()) {
  if (darkCols.has(v.variableCollectionId)) continue;
  const val = await resolve(v);
  if (v.resolvedType === 'COLOR' && val && 'r' in val) colorVars.push({ v, hex: hex(val), a: val.a ?? 1 });
  if (v.resolvedType === 'FLOAT' && typeof val === 'number') floatVars.push({ v, value: val });
};
const spacingVars = floatVars.filter((x) => /spac|gap|space|padding/i.test(x.v.name));
const radiusVars = floatVars.filter((x) => /radius|round|corner/i.test(x.v.name));
const textStyles = [];
for (const s of await figma.getLocalTextStylesAsync()) {
  textStyles.push({ s, family: s.fontName.family, style: s.fontName.style, size: s.fontSize, lh: s.lineHeight.unit === 'PIXELS' ? s.lineHeight.value : null, ls: JSON.stringify(s.letterSpacing), tcase: s.textCase, deco: s.textDecoration });
};

// ---- Recorrido ----
const groups = { color: {}, text: {}, spacing: {}, radius: {}, copies: {}, handmade: {} };
const totals = { nodes: 0, fills: 0, fillsBound: 0, texts: 0, textsStyled: 0, spacing: 0, spacingBound: 0, radius: 0, radiusBound: 0 };
const fixed = { color: 0, text: 0, spacing: 0, radius: 0 };
const add = (map, key, base, node, where) => {
  let g = map[key]; if (!g) { g = { ...base, count: 0, examples: [] }; map[key] = g; }
  g.count++; if (g.examples.length < EXAMPLES) g.examples.push({ id: node.id, name: node.name, where });
};
const screenOf = (n) => { let s = n; while (s.parent && s.parent.type !== 'PAGE') s = s.parent; return s.name; };
const HANDMADE = /\\b(button|btn|bot[oó]n|input|campo|chip|badge|tag|toggle|checkbox|select)\\b/i;

const nearestColor = (h) => colorVars.reduce((best, c) => { const d = dist(h, c.hex); return !best || d < best.d ? { name: c.v.name, d } : best; }, null);
// Coincidencia exacta: si varias variables tienen ese valor, es ambigua y no se vincula sola.
const exactColor = (h, a) => { const m = colorVars.filter((c) => c.hex === h && Math.abs(c.a - a) < 0.01); return m.length ? { v: m[0].v, names: m.map((c) => c.v.name), ambiguous: m.length > 1 } : null; };
const exactFloat = (list, val) => { const m = list.filter((x) => Math.abs(x.value - val) < 0.01); return m.length ? { v: m[0].v, names: m.map((x) => x.v.name), ambiguous: m.length > 1 } : null; };
const tokenLabel = (ex) => (ex ? (ex.ambiguous ? 'ambiguo: ' + ex.names.join(' | ') : ex.names[0]) : null);

async function visit(node) {
  if (node.type === 'INSTANCE') return; // lo de dentro viene del componente
  totals.nodes++;
  const where = PAGE + ' / ' + screenOf(node);
  const b = node.boundVariables || {};

  // Colores de relleno y trazo
  for (const prop of ['fills', 'strokes']) {
    const paints = node[prop];
    if (!Array.isArray(paints)) continue;
    for (let i = 0; i < paints.length; i++) {
      const p = paints[i];
      if (p.type !== 'SOLID' || p.visible === false) continue;
      totals.fills++;
      const bound = (b[prop] || [])[i];
      if (bound) { totals.fillsBound++; continue; }
      const h = hex(p.color), a = p.opacity ?? 1;
      const ex = exactColor(h, a);
      if (FIX && ex && !ex.ambiguous) {
        const copy = [...node[prop]]; copy[i] = figma.variables.setBoundVariableForPaint(p, 'color', ex.v); node[prop] = copy;
        fixed.color++; totals.fillsBound++; continue;
      }
      const near = nearestColor(h);
      add(groups.color, h + '/' + a, { value: h + (a < 1 ? ' ' + Math.round(a * 100) + '%' : ''), token: tokenLabel(ex), nearest: !ex && near ? near.name + ' (diferencia ' + Math.round(near.d) + ')' : null }, node, where);
    }
  }

  // Textos sin estilo
  if (node.type === 'TEXT') {
    totals.texts++;
    if (node.textStyleId && node.textStyleId !== figma.mixed) totals.textsStyled++;
    else if (node.fontSize !== figma.mixed && node.fontName !== figma.mixed) {
      const lh = node.lineHeight !== figma.mixed && node.lineHeight.unit === 'PIXELS' ? node.lineHeight.value : null;
      // Exacto de verdad: también interletrado, mayúsculas y subrayado; si no, aplicar el estilo cambiaría el texto.
      const same = (a, b) => a === b || b === figma.mixed;
      const ex = textStyles.find((t) => t.family === node.fontName.family && t.style === node.fontName.style && Math.abs(t.size - node.fontSize) < 0.5 && (t.lh === null || lh === null || Math.abs(t.lh - lh) < 0.5)
        && node.letterSpacing !== figma.mixed && t.ls === JSON.stringify(node.letterSpacing) && same(t.tcase, node.textCase) && same(t.deco, node.textDecoration));
      if (FIX && ex) { await figma.loadFontAsync(ex.s.fontName); await node.setTextStyleIdAsync(ex.s.id); fixed.text++; totals.textsStyled++; }
      else {
        const near = textStyles.reduce((best, t) => { const d = Math.abs(t.size - node.fontSize) + (t.style === node.fontName.style ? 0 : 2); return !best || d < best.d ? { name: t.s.name, d } : best; }, null);
        add(groups.text, node.fontName.family + '/' + node.fontName.style + '/' + node.fontSize + '/' + lh,
          { value: node.fontName.family + ' ' + node.fontName.style + ' ' + node.fontSize + (lh ? '/' + lh : ''), style: ex ? ex.s.name : null, nearest: !ex && near ? near.name : null }, node, where);
      }
    }
  }

  // Espaciado del auto-layout
  if ('layoutMode' in node && node.layoutMode !== 'NONE') {
    for (const k of ['itemSpacing', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft']) {
      const val = node[k];
      if (!val || val <= 0 || (k === 'itemSpacing' && node.primaryAxisAlignItems === 'SPACE_BETWEEN')) continue;
      totals.spacing++;
      if (b[k]) { totals.spacingBound++; continue; }
      const ex = exactFloat(spacingVars, val);
      if (FIX && ex && !ex.ambiguous) { node.setBoundVariable(k, ex.v); fixed.spacing++; totals.spacingBound++; continue; }
      const near = spacingVars.reduce((best, s) => !best || Math.abs(s.value - val) < Math.abs(best.value - val) ? s : best, null);
      add(groups.spacing, String(val), { value: val, token: tokenLabel(ex), nearest: !ex && near ? near.v.name + ' = ' + near.value : null }, node, where);
    }
  }

  // Radios
  if ('cornerRadius' in node && typeof node.cornerRadius === 'number' && node.cornerRadius > 0 && node.type !== 'TEXT') {
    const isCircle = Math.abs(node.width - node.height) < 1 && node.cornerRadius >= node.width / 2 - 0.5;
    if (!isCircle) {
      totals.radius++;
      if (b.topLeftRadius) totals.radiusBound++;
      else {
        const ex = exactFloat(radiusVars, node.cornerRadius);
        if (FIX && ex && !ex.ambiguous) { for (const k of ['topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius']) node.setBoundVariable(k, ex.v); fixed.radius++; totals.radiusBound++; }
        else add(groups.radius, String(node.cornerRadius), { value: node.cornerRadius, token: tokenLabel(ex) }, node, where);
      }
    }
  }

  // Copias de componentes y controles dibujados a mano
  if (node.type === 'FRAME' || node.type === 'GROUP') {
    const comp = components.find((c) => c.toLowerCase() === node.name.toLowerCase());
    if (comp) add(groups.copies, comp, { component: comp }, node, where);
    else if (HANDMADE.test(node.name) && node.height <= 80) {
      const fill = Array.isArray(node.fills) && node.fills[0] && node.fills[0].type === 'SOLID' ? hex(node.fills[0].color) : 'sin relleno';
      const sig = Math.round(node.height) + 'px alto · radio ' + (typeof node.cornerRadius === 'number' ? node.cornerRadius : '?') + ' · ' + fill;
      add(groups.handmade, node.name.toLowerCase().match(HANDMADE)[1] + ' | ' + sig, { kind: node.name.toLowerCase().match(HANDMADE)[1], signature: sig }, node, where);
    }
  }

  if ('children' in node) for (const c of node.children) await visit(c);
}

for (const id of IDS) { const n = await figma.getNodeByIdAsync(id); if (n) await visit(n); };
if (FIX) figma.commitUndo();
const result = {
  system: { colorVariables: colorVars.length, spacingVariables: spacingVars.length, radiusVariables: radiusVars.length, textStyles: textStyles.length },
  totals, fixed, groups,
};`;
}

const pct = (a, b) => (b ? Math.round((a / b) * 100) : 100);
const list = (g) => Object.values(g).sort((a, b) => b.count - a.count);

export async function audit({ page = null, fix = false, size = 15, log = () => {} } = {}) {
  const { file, components } = await figmaEval(SYSTEM_CODE);
  const { pages, list: work } = await batches({ page, size });
  const groups = { color: {}, text: {}, spacing: {}, radius: {}, copies: {}, handmade: {} };
  const totals = {};
  const fixed = {};
  let system = null;
  for (const [i, b] of work.entries()) {
    log(`Lote ${i + 1}/${work.length}: ${b.page} (${b.ids.length} elementos)`);
    const r = await figmaEvalLarge(batchCode({ ids: b.ids, pageName: b.page, fix, components }));
    system = r.system;
    sumInto(totals, r.totals);
    sumInto(fixed, r.fixed);
    for (const k of Object.keys(groups)) mergeGroups(groups[k], r.groups[k]);
  }
  const t = (k) => totals[k] || 0;
  const cov = (bound, all) => `${pct(t(bound), t(all))}% (${t(bound)}/${t(all)})`;
  return {
    file,
    pages,
    system: { ...(system || {}), components: components.length },
    coverage: { colors: cov('fillsBound', 'fills'), text: cov('textsStyled', 'texts'), spacing: cov('spacingBound', 'spacing'), radius: cov('radiusBound', 'radius') },
    nodes: t('nodes'),
    fixed: fix ? { color: fixed.color || 0, text: fixed.text || 0, spacing: fixed.spacing || 0, radius: fixed.radius || 0 } : null,
    batches: work.length,
    colors: list(groups.color), text: list(groups.text), spacing: list(groups.spacing), radius: list(groups.radius),
    copies: list(groups.copies), handmade: list(groups.handmade),
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const args = process.argv.slice(2);
  const opt = (name) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  try {
    const result = await audit({ page: opt('--page') || null, fix: args.includes('--fix'), size: Number(opt('--batch')) || 15, log: (m) => console.error(m) });
    const pretty = JSON.stringify(result, null, 2);
    if (opt('--out')) writeFileSync(opt('--out'), pretty);
    console.log(pretty);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
