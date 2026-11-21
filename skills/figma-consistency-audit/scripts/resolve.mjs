#!/usr/bin/env node
// Resuelve en bloque lo que la auditoría deja "para decidir". Cada opción es una decisión de
// diseño, así que siempre conviene mirar primero el plan con --dry-run.
//
//   --round-spacing [--max-delta 2]   gaps y paddings fuera de escala → el paso más cercano de la
//                                     escala, solo si la diferencia es ≤ max-delta px (no se pegan a 0)
//   --add-spacing 10                  añade 10 px a la escala (spacing/…) y vincula los que valen 10
//   --color "#fafbfc=bg"              ese color pasa a usar la variable (cambia un poco el tono)
//   --text "Inter Semi Bold 12=Text/Caption Strong"
//                                     aplica ese estilo a los textos con esa fuente, peso y tamaño;
//                                     si el estilo no existe, lo crea con los valores del texto
//   [--page "<página>"] [--dry-run] [--batch 15]
//
// Las opciones se pueden repetir y combinar. Primero prepara el sistema (variables y estilos
// nuevos, una sola vez) y luego recorre el archivo por lotes de pantallas, para no chocar con el
// corte de 25 s del plugin. Cada lote es idempotente (lo ya vinculado no se toca) y termina con
// figma.commitUndo(): Ctrl+Z deshace un lote.
import { pathToFileURL } from 'node:url';
import { figmaEval, figmaEvalLarge, batches, mergeGroups } from './lib.mjs';

export function parseArgs(args) {
  const all = (name) => args.flatMap((a, i) => (a === name ? [args[i + 1]] : []));
  const opt = (name) => all(name)[0];
  const pair = (s) => {
    const i = s.lastIndexOf('=');
    return [s.slice(0, i).trim(), s.slice(i + 1).trim()];
  };
  return {
    page: opt('--page') || null,
    dry: args.includes('--dry-run'),
    size: Number(opt('--batch')) || 15,
    ops: {
      roundSpacing: args.includes('--round-spacing'),
      maxDelta: Number(opt('--max-delta') || 2),
      addSpacing: all('--add-spacing').map(Number),
      colors: all('--color').map(pair).map(([hex, token]) => ({ hex: hex.toLowerCase(), token })),
      texts: all('--text').map(pair).map(([font, style]) => {
        const m = font.match(/^(.*?)\s+(\d+(?:\.\d+)?)(?:\/(\d+(?:\.\d+)?))?$/);
        if (!m) throw new Error(`--text no válido: "${font}". Formato: "Fuente Peso Tamaño[/Interlineado]=Estilo".`);
        const [family, ...rest] = m[1].split(' ');
        return { family, style: rest.join(' '), size: Number(m[2]), lh: m[3] ? Number(m[3]) : null, target: style };
      }),
    },
  };
}

const COMMON = (ops, dry) => `
const OPS = ${JSON.stringify(ops)};
const DRY = ${!!dry};
const cols = await figma.variables.getLocalVariableCollectionsAsync();
const darkCols = new Set(cols.filter((c) => /dark|oscuro/i.test(c.name)).map((c) => c.id));
const vars = (await figma.variables.getLocalVariablesAsync()).filter((v) => !darkCols.has(v.variableCollectionId));
const firstVal = (v) => Object.values(v.valuesByMode)[0];
const spacing = vars.filter((v) => v.resolvedType === 'FLOAT' && /spac|gap|space|padding/i.test(v.name) && typeof firstVal(v) === 'number').map((v) => ({ v, value: firstVal(v) }));
`;

// Fase 1, una sola vez: crea los pasos de espaciado y los estilos de texto que falten.
// Es idempotente: si ya existen, no crea nada.
function prepareCode(ops, dry) {
  return `${COMMON(ops, dry)}
const report = { added: [], createdStyles: [], missing: [] };
for (const px of OPS.addSpacing) {
  if (spacing.some((s) => Math.abs(s.value - px) < 0.01)) continue;
  const col = spacing.length ? cols.find((c) => c.id === spacing[0].v.variableCollectionId) : null;
  const name = (spacing.length && spacing[0].v.name.includes('/') ? spacing[0].v.name.split('/')[0] + '/' : 'spacing/') + px;
  report.added.push(name + ' = ' + px);
  if (DRY) { spacing.push({ v: { name }, value: px }); continue; }
  const target = col || figma.variables.createVariableCollection('Spacing');
  const v = figma.variables.createVariable(name, target, 'FLOAT');
  v.setValueForMode(target.modes[0].modeId, px);
  spacing.push({ v, value: px });
};
for (const c of OPS.colors) {
  if (!vars.some((x) => x.resolvedType === 'COLOR' && (x.name === c.token || x.name.split('/').pop() === c.token))) report.missing.push('variable ' + c.token);
};
const styles = await figma.getLocalTextStylesAsync();
for (const t of OPS.texts) {
  if (styles.some((x) => x.name === t.target)) continue;
  if (DRY) { report.createdStyles.push(t.target + ' (se crearía)'); continue; }
  await figma.loadFontAsync({ family: t.family, style: t.style });
  const s = figma.createTextStyle();
  s.name = t.target; s.fontName = { family: t.family, style: t.style }; s.fontSize = t.size;
  if (t.lh) s.lineHeight = { unit: 'PIXELS', value: t.lh };
  report.createdStyles.push(t.target);
};
if (!DRY) figma.commitUndo();
// En simulación, los pasos nuevos no existen todavía: los lotes los reciben como valores.
report.simulated = DRY ? report.added.map((a) => { const [name, px] = a.split(' = '); return { name, value: Number(px) }; }) : [];
JSON.stringify(report)`;
}

// Fase 2, un lote de pantallas de primer nivel.
function batchCode({ ops, dry, ids, simulated }) {
  return `${COMMON(ops, dry)}
const IDS = ${JSON.stringify(ids)};
for (const s of ${JSON.stringify(simulated)}) spacing.push({ v: { name: s.name }, value: s.value });
const hex = (c) => '#' + [c.r, c.g, c.b].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
const report = { spacing: {}, colors: {}, texts: {} };
const bump = (o, k, ex) => { o[k] = o[k] || { count: 0, examples: [] }; o[k].count++; if (o[k].examples.length < 3) o[k].examples.push(ex); };
const roundTargets = spacing.filter((s) => s.value > 0);
const colorOps = [];
for (const c of OPS.colors) {
  const v = vars.find((x) => x.resolvedType === 'COLOR' && (x.name === c.token || x.name.split('/').pop() === c.token));
  if (v) colorOps.push({ ...c, v });
};
const styles = await figma.getLocalTextStylesAsync();
const textOps = [];
for (const t of OPS.texts) {
  const s = styles.find((x) => x.name === t.target) || null;
  if (s && !DRY) await figma.loadFontAsync(s.fontName);
  textOps.push({ ...t, s });
};

const screenOf = (n) => { let s = n; while (s.parent && s.parent.type !== 'PAGE') s = s.parent; return s.name; };
async function visit(node) {
  if (node.type === 'INSTANCE') return;
  const b = node.boundVariables || {};
  if (OPS.roundSpacing || OPS.addSpacing.length) {
    if ('layoutMode' in node && node.layoutMode !== 'NONE') {
      for (const k of ['itemSpacing', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft']) {
        const val = node[k];
        if (!val || val <= 0 || b[k] || (k === 'itemSpacing' && node.primaryAxisAlignItems === 'SPACE_BETWEEN')) continue;
        let target = spacing.find((s) => Math.abs(s.value - val) < 0.01 && OPS.addSpacing.includes(s.value));
        if (!target && OPS.roundSpacing && !spacing.some((s) => Math.abs(s.value - val) < 0.01)) {
          const near = roundTargets.reduce((best, s) => !best || Math.abs(s.value - val) < Math.abs(best.value - val) || (Math.abs(s.value - val) === Math.abs(best.value - val) && s.value < best.value) ? s : best, null);
          if (near && Math.abs(near.value - val) <= OPS.maxDelta) target = near;
        }
        if (!target) continue;
        bump(report.spacing, val + ' → ' + target.v.name + ' (' + target.value + ')', node.name + ' · ' + screenOf(node));
        if (!DRY) node.setBoundVariable(k, target.v);
      }
    }
  }
  for (const prop of ['fills', 'strokes']) {
    if (!colorOps.length || !Array.isArray(node[prop])) continue;
    const paints = node[prop];
    let changed = false; const copy = [...paints];
    paints.forEach((p, i) => {
      if (p.type !== 'SOLID' || p.visible === false || (b[prop] || [])[i]) return;
      const op = colorOps.find((c) => c.hex === hex(p.color));
      if (!op) return;
      bump(report.colors, op.hex + ' → ' + op.v.name, node.name + ' · ' + screenOf(node));
      if (!DRY) { copy[i] = figma.variables.setBoundVariableForPaint(p, 'color', op.v); changed = true; }
    });
    if (changed) node[prop] = copy;
  }
  if (node.type === 'TEXT' && textOps.length && (!node.textStyleId || node.textStyleId === figma.mixed) && node.fontName !== figma.mixed && node.fontSize !== figma.mixed) {
    const lh = node.lineHeight !== figma.mixed && node.lineHeight.unit === 'PIXELS' ? node.lineHeight.value : null;
    const op = textOps.find((t) => t.family === node.fontName.family && t.style === node.fontName.style && Math.abs(t.size - node.fontSize) < 0.5 && (t.lh === null || lh === null || Math.abs(t.lh - lh) < 0.5));
    if (op) {
      bump(report.texts, op.family + ' ' + op.style + ' ' + op.size + ' → ' + op.target, node.characters.slice(0, 24) + ' · ' + screenOf(node));
      if (!DRY && op.s) await node.setTextStyleIdAsync(op.s.id);
    }
  }
  if ('children' in node) for (const c of node.children) await visit(c);
}
for (const id of IDS) { const n = await figma.getNodeByIdAsync(id); if (n) await visit(n); };
if (!DRY) figma.commitUndo();
const result = report;`;
}

export async function resolve({ ops, page = null, dry = false, size = 15, log = () => {} }) {
  if (!ops.roundSpacing && !ops.addSpacing.length && !ops.colors.length && !ops.texts.length) {
    throw new Error('Nada que resolver. Usa --round-spacing, --add-spacing <px>, --color "#hex=variable" o --text "Fuente Peso Tamaño=Estilo".');
  }
  const prep = await figmaEval(prepareCode(ops, dry));
  const { list } = await batches({ page, size });
  const merged = { spacing: {}, colors: {}, texts: {} };
  for (const [i, b] of list.entries()) {
    log(`Lote ${i + 1}/${list.length}: ${b.page} (${b.ids.length} elementos)`);
    const r = await figmaEvalLarge(batchCode({ ops, dry, ids: b.ids, simulated: prep.simulated }));
    for (const k of Object.keys(merged)) mergeGroups(merged[k], r[k], 3);
  }
  return { dryRun: dry, batches: list.length, spacing: merged.spacing, added: prep.added, colors: merged.colors, texts: merged.texts, createdStyles: prep.createdStyles, missing: prep.missing };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  try {
    const { ops, page, dry, size } = parseArgs(process.argv.slice(2));
    console.log(JSON.stringify(await resolve({ ops, page, dry, size, log: (m) => console.error(m) }), null, 2));
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
