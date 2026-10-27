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
//   [--page "<página>"] [--dry-run]
//
// Las opciones se pueden repetir y combinar. Termina con figma.commitUndo(): Ctrl+Z lo deshace.
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';

const args = process.argv.slice(2);
const all = (name) => args.flatMap((a, i) => (a === name ? [args[i + 1]] : []));
const opt = (name) => all(name)[0];
const pair = (s) => {
  const i = s.lastIndexOf('=');
  return [s.slice(0, i).trim(), s.slice(i + 1).trim()];
};
const ops = {
  roundSpacing: args.includes('--round-spacing'),
  maxDelta: Number(opt('--max-delta') || 2),
  addSpacing: all('--add-spacing').map(Number),
  colors: all('--color').map(pair).map(([hex, token]) => ({ hex: hex.toLowerCase(), token })),
  texts: all('--text').map(pair).map(([font, style]) => {
    const m = font.match(/^(.*?)\s+(\d+(?:\.\d+)?)(?:\/(\d+(?:\.\d+)?))?$/);
    const [family, ...rest] = m[1].split(' ');
    return { family, style: rest.join(' '), size: Number(m[2]), lh: m[3] ? Number(m[3]) : null, target: style };
  }),
};
if (!ops.roundSpacing && !ops.addSpacing.length && !ops.colors.length && !ops.texts.length) {
  console.error('Nada que resolver. Usa --round-spacing, --add-spacing <px>, --color "#hex=variable" o --text "Fuente Peso Tamaño=Estilo".');
  process.exit(1);
}
const cli = process.env.FIGMA_CLI || 'figma-cli';

const code = `
const OPS = ${JSON.stringify(ops)};
const ONLY_PAGE = ${JSON.stringify(opt('--page') || null)};
const DRY = ${args.includes('--dry-run')};
const hex = (c) => '#' + [c.r, c.g, c.b].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
const report = { spacing: {}, added: [], colors: {}, texts: {}, createdStyles: [], missing: [] };
const bump = (o, k, ex) => { o[k] = o[k] || { count: 0, examples: [] }; o[k].count++; if (o[k].examples.length < 3) o[k].examples.push(ex); };

// ---- Escala de espaciado (sin las colecciones de tema oscuro) ----
const cols = await figma.variables.getLocalVariableCollectionsAsync();
const darkCols = new Set(cols.filter((c) => /dark|oscuro/i.test(c.name)).map((c) => c.id));
const vars = (await figma.variables.getLocalVariablesAsync()).filter((v) => !darkCols.has(v.variableCollectionId));
const firstVal = (v) => Object.values(v.valuesByMode)[0];
let spacing = vars.filter((v) => v.resolvedType === 'FLOAT' && /spac|gap|space|padding/i.test(v.name) && typeof firstVal(v) === 'number').map((v) => ({ v, value: firstVal(v) }));

// --add-spacing: nueva variable en la colección de la escala
for (const px of OPS.addSpacing) {
  if (spacing.some((s) => Math.abs(s.value - px) < 0.01)) continue;
  const col = spacing.length ? cols.find((c) => c.id === spacing[0].v.variableCollectionId) : null;
  const name = (spacing.length && spacing[0].v.name.includes('/') ? spacing[0].v.name.split('/')[0] + '/' : 'spacing/') + px;
  if (DRY) { report.added.push(name + ' = ' + px); spacing.push({ v: { name, id: null }, value: px }); continue; }
  const target = col || figma.variables.createVariableCollection('Spacing');
  const v = figma.variables.createVariable(name, target, 'FLOAT');
  v.setValueForMode(target.modes[0].modeId, px);
  spacing.push({ v, value: px });
  report.added.push(name + ' = ' + px);
}
const roundTargets = spacing.filter((s) => s.value > 0);

// ---- Variables de color pedidas ----
const colorOps = [];
for (const c of OPS.colors) {
  const v = vars.find((x) => x.resolvedType === 'COLOR' && (x.name === c.token || x.name.split('/').pop() === c.token));
  if (v) colorOps.push({ ...c, v }); else report.missing.push('variable ' + c.token);
}

// ---- Estilos de texto pedidos (se crean si no existen) ----
const styles = await figma.getLocalTextStylesAsync();
const textOps = [];
for (const t of OPS.texts) {
  let s = styles.find((x) => x.name === t.target);
  if (!s && !DRY) {
    await figma.loadFontAsync({ family: t.family, style: t.style });
    s = figma.createTextStyle();
    s.name = t.target; s.fontName = { family: t.family, style: t.style }; s.fontSize = t.size;
    if (t.lh) s.lineHeight = { unit: 'PIXELS', value: t.lh };
    report.createdStyles.push(t.target);
  } else if (!s) report.createdStyles.push(t.target + ' (se crearía)');
  if (s) await figma.loadFontAsync(s.fontName);
  textOps.push({ ...t, s });
}

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
for (const p of figma.root.children) {
  if (ONLY_PAGE && p.name !== ONLY_PAGE) continue;
  await p.loadAsync();
  for (const c of p.children) await visit(c);
}
if (!DRY) figma.commitUndo();
const result = { dryRun: DRY, ...report };
JSON.stringify(result)`;

const dir = mkdtempSync(join(tmpdir(), 'fs-resolve-'));
try {
  const f = join(dir, 'resolve.js');
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
