#!/usr/bin/env node
// Auditoría de coherencia de un archivo de Figma completo: qué se sale del design system,
// agrupado por valor y con la variable o el estilo que debería usarse.
//
//   node audit.mjs                       informe de todo el archivo (JSON)
//   node audit.mjs --page "Pantallas"    solo esa página
//   node audit.mjs --fix                 además vincula lo que coincide EXACTAMENTE con el sistema
//   node audit.mjs --out informe.json    guarda el informe
//
// --fix nunca cambia el aspecto: solo vincula colores, espaciados y radios al token que ya tiene
// ese valor, y aplica el estilo de texto que ya coincide en fuente, tamaño, peso e interlineado.
// Usa `figma-cli` del PATH; FIGMA_CLI="npx -p figma-ds-cli figma-cli" lo cambia.
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const fix = args.includes('--fix');
const page = opt('--page');
const out = opt('--out');
const cli = process.env.FIGMA_CLI || 'figma-cli';

// Código que corre dentro de Figma (Plugin API). Termina en "; JSON.stringify(…)": figma-cli
// eval devuelve lo que va tras el último ";".
const code = `
const ONLY_PAGE = ${JSON.stringify(page || null)};
const FIX = ${fix};
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
}
const spacingVars = floatVars.filter((x) => /spac|gap|space|padding/i.test(x.v.name));
const radiusVars = floatVars.filter((x) => /radius|round|corner/i.test(x.v.name));
const textStyles = [];
for (const s of await figma.getLocalTextStylesAsync()) {
  textStyles.push({ s, family: s.fontName.family, style: s.fontName.style, size: s.fontSize, lh: s.lineHeight.unit === 'PIXELS' ? s.lineHeight.value : null, ls: JSON.stringify(s.letterSpacing), tcase: s.textCase, deco: s.textDecoration });
}
const components = [];
for (const p of figma.root.children) {
  await p.loadAsync();
  p.findAllWithCriteria({ types: ['COMPONENT', 'COMPONENT_SET'] }).forEach((c) => {
    if (c.type === 'COMPONENT' && c.parent && c.parent.type === 'COMPONENT_SET') return;
    components.push(c.name);
  });
}

// ---- Recorrido ----
const groups = { color: new Map(), text: new Map(), spacing: new Map(), radius: new Map(), copies: new Map(), handmade: new Map() };
const totals = { nodes: 0, fills: 0, fillsBound: 0, texts: 0, textsStyled: 0, spacing: 0, spacingBound: 0, radius: 0, radiusBound: 0 };
const fixed = { color: 0, text: 0, spacing: 0, radius: 0 };
const add = (map, key, base, node, where) => {
  let g = map.get(key); if (!g) { g = { ...base, count: 0, examples: [] }; map.set(key, g); }
  g.count++; if (g.examples.length < EXAMPLES) g.examples.push({ id: node.id, name: node.name, where });
};
const screenOf = (n) => { let s = n; while (s.parent && s.parent.type !== 'PAGE') s = s.parent; return s.name; };
const HANDMADE = /\\b(button|btn|bot[oó]n|input|campo|chip|badge|tag|toggle|checkbox|select)\\b/i;

const nearestColor = (h) => colorVars.reduce((best, c) => { const d = dist(h, c.hex); return !best || d < best.d ? { name: c.v.name, d } : best; }, null);
// Coincidencia exacta: si varias variables tienen ese valor, es ambigua y no se vincula sola.
const exactColor = (h, a) => { const m = colorVars.filter((c) => c.hex === h && Math.abs(c.a - a) < 0.01); return m.length ? { v: m[0].v, names: m.map((c) => c.v.name), ambiguous: m.length > 1 } : null; };
const exactFloat = (list, val) => { const m = list.filter((x) => Math.abs(x.value - val) < 0.01); return m.length ? { v: m[0].v, names: m.map((x) => x.v.name), ambiguous: m.length > 1 } : null; };
const tokenLabel = (ex) => (ex ? (ex.ambiguous ? 'ambiguo: ' + ex.names.join(' | ') : ex.names[0]) : null);

async function visit(node, pageName) {
  if (node.type === 'INSTANCE') return; // lo de dentro viene del componente
  totals.nodes++;
  const where = pageName + ' / ' + screenOf(node);
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
        const copy = [...paints]; copy[i] = figma.variables.setBoundVariableForPaint(p, 'color', ex.v); node[prop] = copy;
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

  if ('children' in node) for (const c of node.children) await visit(c, pageName);
}

const pages = figma.root.children.filter((p) => !ONLY_PAGE || p.name === ONLY_PAGE);
for (const p of pages) { await p.loadAsync(); for (const c of p.children) await visit(c, p.name); }

const list = (m) => [...m.values()].sort((a, b) => b.count - a.count);
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 100);
const result = {
  file: figma.root.name,
  pages: pages.map((p) => p.name),
  system: { colorVariables: colorVars.length, spacingVariables: spacingVars.length, radiusVariables: radiusVars.length, textStyles: textStyles.length, components: components.length },
  coverage: {
    colors: pct(totals.fillsBound, totals.fills) + '% (' + totals.fillsBound + '/' + totals.fills + ')',
    text: pct(totals.textsStyled, totals.texts) + '% (' + totals.textsStyled + '/' + totals.texts + ')',
    spacing: pct(totals.spacingBound, totals.spacing) + '% (' + totals.spacingBound + '/' + totals.spacing + ')',
    radius: pct(totals.radiusBound, totals.radius) + '% (' + totals.radiusBound + '/' + totals.radius + ')',
  },
  nodes: totals.nodes,
  fixed: FIX ? fixed : null,
  colors: list(groups.color), text: list(groups.text), spacing: list(groups.spacing), radius: list(groups.radius),
  copies: list(groups.copies), handmade: list(groups.handmade),
};
// figma-cli corta cada resultado a 20 000 caracteres: el informe se queda en memoria del plugin
// y se lee por partes.
globalThis.__fsAudit = JSON.stringify(result);
JSON.stringify({ length: globalThis.__fsAudit.length })`;

const CHUNK = 15000;

const dir = mkdtempSync(join(tmpdir(), 'fs-audit-'));
let n = 0;
function evalCode(src) {
  const f = join(dir, `eval-${++n}.js`);
  writeFileSync(f, src);
  const raw = execSync(`${cli} eval -f "${f}"`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 26 });
  const json = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
  try {
    return JSON.parse(json);
  } catch {
    console.error(`figma-cli no devolvió lo esperado:
${raw.slice(0, 2000)}`);
    process.exit(1);
  }
}
try {
  const { length } = evalCode(code);
  let text = '';
  for (let i = 0; i < length; i += CHUNK) {
    text += evalCode(`JSON.stringify({ part: globalThis.__fsAudit.slice(${i}, ${i + CHUNK}) })`).part;
  }
  evalCode('globalThis.__fsAudit = null; JSON.stringify({ ok: true })');
  const result = JSON.parse(text);
  const pretty = JSON.stringify(result, null, 2);
  if (out) writeFileSync(out, pretty);
  console.log(pretty);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
