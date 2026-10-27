#!/usr/bin/env node
// Primera pasada responsive: copia una pantalla de escritorio y crea a su derecha las versiones de
// tablet y móvil, reorganizando el auto-layout. La original no se toca.
//
//   node responsive.mjs --id 16:2789 [--widths 768,390]
//
// Reglas, para cada ancho:
// · menú lateral (columna vertical estrecha, a toda altura, junto al contenido): se oculta por
//   debajo de 1024 px y se avisa, para diseñar su versión móvil (barra inferior o menú);
// · fila que no cabe: si son tarjetas parecidas → 2 columnas con salto de línea (tablet) o una
//   debajo de otra (móvil); si es una fila mixta (título + acciones, tabla + columna) → en
//   vertical, sin los espaciadores vacíos;
// · un ancho fijo que ya no cabe → ocupa el ancho disponible;
// · la altura se ajusta al contenido.
// Es un punto de partida: hay que revisar cada versión y afinarla.
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const id = opt('--id');
if (!id) {
  console.error('Uso: node responsive.mjs --id <id de la pantalla> [--widths 768,390]');
  process.exit(1);
}
const widths = (opt('--widths') || '768,390').split(',').map(Number);
const cli = process.env.FIGMA_CLI || 'figma-cli';

// Una llamada por ancho: cada una queda muy por debajo de los 25 s del plugin.
const code = (width, index) => `
const W = ${width};
const src = await figma.getNodeByIdAsync(${JSON.stringify(id)});
const label = W >= 600 ? 'Tablet' : 'Móvil';
const name = src.name + ' · ' + label + ' ' + W;
const changes = [];
// Si ya existe esa versión (una pasada anterior), se rehace desde la original.
for (const old of src.parent.children.filter((c) => c.name === name)) old.remove();
const s = src.clone();
s.name = name;
src.parent.appendChild(s);
s.x = src.x + src.width + 120 + ${index} * (W + 120);
s.y = src.y;

const isAL = (n) => 'layoutMode' in n && n.layoutMode !== 'NONE';
const isSpacer = (n) => /^(espacio|spacer)$/i.test(n.name);
const contentWidth = (n) => n.width - (n.paddingLeft || 0) - (n.paddingRight || 0);

// Anchos de escritorio de cada nodo (para saber cuánto puede encoger lo que se estira).
const desk = new Map();
(function measure(n) { desk.set(n.id, n.width); if ('children' in n && n.type !== 'INSTANCE') n.children.forEach(measure); })(s);

// Menú lateral: se decide con los anchos de escritorio, antes de encoger.
let sidebar = null;
if (W < 1024 && s.layoutMode === 'HORIZONTAL') {
  sidebar = s.children.find((c) => c.visible && isAL(c) && c.layoutMode === 'VERTICAL' && c.width <= 320 && c.height >= s.height * 0.8 && s.children.some((o) => o !== c && o.width > c.width * 2)) || null;
}

// 1. Ancho de la pantalla y altura según el contenido
s.resize(W, s.height);
if (s.layoutMode === 'VERTICAL') s.primaryAxisSizingMode = 'AUTO';
if (s.layoutMode === 'HORIZONTAL') s.counterAxisSizingMode = 'AUTO';

// 2. Menú lateral
if (sidebar) {
  sidebar.visible = false;
  changes.push('menú lateral "' + sidebar.name + '" oculto: diseña su versión ' + label.toLowerCase() + ' (barra inferior o menú)');
}

// 3. Recorrido de arriba abajo
function similarCards(n) {
  const kids = n.children.filter((c) => c.visible && !isSpacer(c));
  if (kids.length < 2) return false;
  // Repetidos: la mayoría con el mismo nombre (o instancias del mismo tipo) y tamaños parecidos.
  const counts = {}; kids.forEach((c) => { counts[c.name] = (counts[c.name] || 0) + 1; });
  const repeated = Math.max(...Object.values(counts)) >= Math.ceil(kids.length * 2 / 3);
  const w = kids.map((c) => desk.get(c.id) || c.width), h = kids.map((c) => c.height);
  return repeated && kids.every((c) => c.type === 'FRAME' || c.type === 'INSTANCE') && Math.max(...w) / Math.min(...w) < 1.3 && Math.max(...h) / Math.min(...h) < 1.3;
}
function needed(n) {
  const kids = n.children.filter((c) => c.visible && c.layoutPositioning !== 'ABSOLUTE' && !isSpacer(c));
  // Lo que se estira puede encoger hasta el 70 % de su ancho de escritorio; lo pequeño (barras o
  // columnas de un gráfico, de menos de 120 px) hasta la mitad, para que encoja en vez de apilarse.
  // Fila de icono + texto + flecha: si lo único que se estira es el texto y lo demás es pequeño
  // (≤ 64 px), el texto encoge y salta de línea; la fila se queda como está.
  const fillKids = kids.filter((c) => c.layoutSizingHorizontal === 'FILL');
  const smallRest = fillKids.length === 1 && kids.every((c) => c === fillKids[0] || c.width <= 64);
  const minFill = (c) => { const d = desk.get(c.id) || c.width; return smallRest ? Math.min(d, 80) : d < 120 ? Math.max(24, 0.5 * d) : 0.7 * d; };
  const sum = kids.reduce((a, c) => a + (c.layoutSizingHorizontal === 'FILL' ? minFill(c) : Math.min(c.width, contentWidth(n))), 0);
  return sum + n.itemSpacing * Math.max(0, kids.length - 1);
}
// Icono + columna de texto (ancho fijo) + flecha: lo demás es pequeño y nada se estira todavía.
function iconTextRow(n) {
  const kids = n.children.filter((c) => c.visible && !isSpacer(c) && c.layoutPositioning !== 'ABSOLUTE');
  if (kids.length < 2 || kids.some((c) => c.layoutSizingHorizontal === 'FILL')) return false;
  const main = kids.reduce((a, c) => (c.width > a.width ? c : a));
  return kids.every((c) => c === main || c.width <= 64) && texts(main).length > 0;
}
const texts = (n) => (n.type === 'TEXT' ? [n] : 'children' in n ? n.children.flatMap(texts) : []);
function stack(n) {
  n.layoutMode = 'VERTICAL';
  n.counterAxisAlignItems = 'MIN';
  n.primaryAxisSizingMode = 'AUTO';
  for (const c of n.children) {
    if (isSpacer(c)) { c.visible = false; continue; }
    if (c.layoutPositioning === 'ABSOLUTE') continue;
    try { c.layoutSizingHorizontal = 'FILL'; } catch (e) {}
    try { if (c.layoutSizingVertical === 'FILL') c.layoutSizingVertical = 'HUG'; } catch (e) {}
  }
}
function visit(n) {
  if (!n.visible || n.type === 'INSTANCE') return;
  const parent = n.parent;
  // En móvil, la cabecera de una tabla no tiene columnas a las que dar nombre: se oculta.
  if (W < 600 && /^(encabezado|thead|table-?head(er)?|cabecera)$/i.test(n.name)) {
    n.visible = false;
    changes.push('cabecera de tabla "' + n.name + '" oculta');
    return;
  }
  // Un espaciador de ancho fijo empujaría lo de su derecha fuera de la pantalla: pasa a estirarse.
  if (isSpacer(n) && parent && isAL(parent) && parent.layoutMode === 'HORIZONTAL' && n.layoutSizingHorizontal === 'FIXED') {
    n.resize(1, n.height);
    try { n.layoutSizingHorizontal = 'FILL'; } catch (e) {}
    return;
  }
  // Un ancho fijo que no cabe en su contenedor pasa a ocupar el ancho disponible.
  if (parent && isAL(parent) && n !== s && n.layoutPositioning !== 'ABSOLUTE' && n.layoutSizingHorizontal === 'FIXED' && n.width > contentWidth(parent) + 0.5) {
    try { n.layoutSizingHorizontal = 'FILL'; } catch (e) { n.resize(contentWidth(parent), n.height); }
  }
  if (isAL(n) && n.layoutMode === 'HORIZONTAL' && n.children.length > 1 && needed(n) > contentWidth(n) + 0.5) {
    if (similarCards(n) && W >= 600) {
      const kids = n.children.filter((c) => c.visible && !isSpacer(c));
      n.layoutWrap = 'WRAP';
      n.counterAxisSpacing = n.itemSpacing;
      const colW = Math.floor((contentWidth(n) - n.itemSpacing) / 2);
      for (const c of kids) { try { c.layoutSizingHorizontal = 'FIXED'; } catch (e) {} c.resize(colW, c.height); }
      try { n.layoutSizingVertical = 'HUG'; } catch (e) {}
      changes.push('"' + n.name + '": ' + kids.length + ' tarjetas en 2 columnas');
    } else if (iconTextRow(n)) {
      // La columna de texto (fija) pasa a estirarse: encoge y su texto salta de línea.
      const kids = n.children.filter((c) => c.visible && !isSpacer(c));
      const main = kids.reduce((a, c) => (c.width > a.width ? c : a));
      try { main.layoutSizingHorizontal = 'FILL'; } catch (e) {}
    } else if (!n.children.some((c) => c.visible && !isSpacer(c) && c.layoutSizingHorizontal === 'FILL')) {
      // Barra de herramientas (nada se estira): los elementos saltan a la línea siguiente.
      for (const c of n.children) if (isSpacer(c)) c.visible = false;
      n.layoutWrap = 'WRAP';
      n.counterAxisSpacing = n.itemSpacing;
      try { n.layoutSizingVertical = 'HUG'; } catch (e) {}
      changes.push('"' + n.name + '": salta de línea');
    } else {
      stack(n);
      changes.push('"' + n.name + '": de fila a columna');
    }
  }
  if ('children' in n) for (const c of n.children) visit(c);
  // Las columnas que tenían alto fijo crecen con su contenido.
  if (isAL(n) && n.layoutMode === 'VERTICAL' && n !== s) { try { if (n.layoutSizingVertical === 'FIXED') n.layoutSizingVertical = 'HUG'; } catch (e) {} }
}
for (const c of s.children) visit(c);
if (s.layoutMode === 'HORIZONTAL') { try { s.layoutSizingVertical = 'HUG'; } catch (e) {} }
figma.commitUndo();
const result = { id: s.id, name: s.name, width: Math.round(s.width), height: Math.round(s.height), changes: changes.slice(0, 40) };
JSON.stringify(result)`;

const dir = mkdtempSync(join(tmpdir(), 'fs-responsive-'));
const out = [];
try {
  widths.forEach((w, i) => {
    const f = join(dir, `w${w}.js`);
    writeFileSync(f, code(w, i));
    let raw;
    try {
      raw = execSync(`${cli} eval -f "${f}"`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 26 });
    } catch (e) {
      raw = `${e.stdout || ''}${e.stderr || ''}`;
    }
    const json = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
    try {
      out.push(JSON.parse(json));
    } catch {
      throw new Error(`figma-cli no devolvió lo esperado (${w} px):\n${raw.slice(0, 2000)}`);
    }
  });
  console.log(JSON.stringify(out, null, 2));
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  rmSync(dir, { recursive: true, force: true });
}
