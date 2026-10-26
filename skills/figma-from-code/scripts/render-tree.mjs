#!/usr/bin/env node
// Renderiza en Figma el árbol de piezas que devuelve dom-to-figma (out.tree), en orden: cada
// pieza se renderiza en la página y después se mueve dentro de su padre. Así ningún render es
// tan grande como para que Figma deje de responder (con ~300 nodos en una llamada, el plugin
// se desconecta y figma-cli reintenta y duplica).
//
// No usa `render --parent`, y quita el w="fill" de la raíz de cada pieza antes de renderizarla:
// en figma-cli 2.2.5 un "fill" en la raíz hace fallar el render con un error engañoso
// ("'frame' is not defined").
//
//   node render-tree.mjs tree.json --page "Desde código" [-c Colección] [--parent <id>]
//
// tree.json puede ser el árbol ({ jsx, children, shell }) o todo el resultado ({ jsx, tree }).
// Usa `figma-cli` del PATH; con FIGMA_CLI="npx -p figma-ds-cli figma-cli" se cambia el comando.
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';

const args = process.argv.slice(2);
const valued = ['--page', '-c', '--collection', '--parent'];
const file = args.find((a, i) => !a.startsWith('-') && !valued.includes(args[i - 1]));
const opt = (...names) => {
  const i = args.findIndex((a) => names.includes(a));
  return i >= 0 ? args[i + 1] : undefined;
};
if (!file) {
  console.error('Uso: node render-tree.mjs tree.json --page "<página>" [-c <colección>] [--parent <id>]');
  process.exit(1);
}

const data = JSON.parse(readFileSync(file, 'utf8'));
const tree = data.tree || data;
const page = opt('--page');
const collection = opt('-c', '--collection');
const cli = process.env.FIGMA_CLI || 'figma-cli';
const dir = mkdtempSync(join(tmpdir(), 'render-tree-'));
const quote = (s) => `"${String(s).replace(/"/g, '\\"')}"`;
const created = [];
let calls = 0;

const ATTEMPTS = 3;
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

function run(args) {
  return execSync(`${cli} ${args}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function evalCode(code) {
  const f = join(dir, `eval-${Date.now()}-${Math.random().toString(36).slice(2)}.js`);
  writeFileSync(f, code);
  return run(`eval -f ${quote(f)}`).trim().split('\n').pop();
}

const pageExpr = page
  ? `figma.root.children.find(p=>p.name===${JSON.stringify(page)})`
  : 'figma.currentPage';

// IDs de lo que hay en el primer nivel de la página destino.
function topLevel() {
  try {
    return JSON.parse(evalCode(`const p=${pageExpr}; if(!p) []; else { await p.loadAsync(); JSON.stringify(p.children.map(c=>c.id)) }`));
  } catch (e) {
    return [];
  }
}

function removeIds(ids) {
  if (ids.length) evalCode(`for (const id of ${JSON.stringify(ids)}) { const n=await figma.getNodeByIdAsync(id); if(n) n.remove() }; "ok"`);
}

// figma-cli reintenta por su cuenta cuando Figma tarda (> 90 s) y deja copias sueltas en la
// página, a veces incluso cuando el render acaba bien. Por eso cada pieza compara el primer
// nivel de la página antes y después, borra lo que sobra y, si falló, espera y lo repite.
function render(jsx) {
  const f = join(dir, `piece-${++calls}.jsx`);
  // Un w="fill"/h="fill" en la raíz no tiene auto-layout donde llenar y el render falla
  // ("'frame' is not defined"): se quita aquí y moveInto lo restaura dentro del padre.
  const lines = jsx.split('\n');
  lines[0] = lines[0].replace(/\s(w|h)="fill"/g, '');
  writeFileSync(f, lines.join('\n'));
  // --keep-wrapper: sin él, figma-cli separa "N elementos parecidos dentro de un flex" (una
  // fila de tarjetas) en piezas sueltas del lienzo y solo devuelve el ID de la primera.
  const flags = [`-f ${quote(f)}`, '--keep-wrapper'];
  if (page) flags.push(`--page ${quote(page)}`);
  if (collection) flags.push(`-c ${quote(collection)}`);

  let lastOut = '';
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const before = new Set(topLevel());
    let out;
    try {
      out = run(`render ${flags.join(' ')}`);
    } catch (e) {
      out = `${e.stdout || ''}${e.stderr || ''}`;
      sleep(5000); // tras un timeout Figma puede seguir creando la pieza un rato
    }
    lastOut = out;
    const id = (out.match(/Rendered: ([0-9]+:[0-9]+)/) || [])[1];
    const extras = topLevel().filter((x) => !before.has(x) && x !== id);
    removeIds(extras);
    if (extras.length) cleaned += extras.length;
    if (id) {
      created.push(id);
      return id;
    }
    if (attempt < ATTEMPTS) console.error(`Pieza ${calls}: intento ${attempt} falló, se repite.`);
  }
  throw new Error(`No se obtuvo el ID del render tras ${ATTEMPTS} intentos:\n${lastOut}`);
}
let cleaned = 0;

// Mete el nodo al final del padre y le devuelve el "fill" que tenía en el JSX: al estar fuera
// de un auto-layout, render no pudo aplicarlo.
function moveInto(id, parent, jsx) {
  const head = jsx.split('\n')[0];
  const fillW = /\bw="fill"/.test(head);
  const fillH = /\bh="fill"/.test(head);
  const code =
    `const n=await figma.getNodeByIdAsync(${JSON.stringify(id)}); const p=await figma.getNodeByIdAsync(${JSON.stringify(parent)});` +
    ` p.appendChild(n);` +
    (fillW ? ` n.layoutSizingHorizontal="FILL";` : '') +
    (fillH ? ` n.layoutSizingVertical="FILL";` : '') +
    ` "ok"`;
  const f = join(dir, `move-${calls}.js`);
  writeFileSync(f, code);
  const out = run(`eval -f ${quote(f)}`);
  if (!/ok/.test(out)) throw new Error(`No se pudo mover ${id} dentro de ${parent}:\n${out}`);
}

// render solo acepta JSX que empiece por <Frame>: una pieza que es un solo texto, icono o
// instancia se envuelve en un frame temporal; luego se mueve su contenido y se borra el envoltorio.
const WRAP = '__render_tree_wrap__';

function walk(node, parent) {
  const leaf = !/^\s*<Frame\b/.test(node.jsx);
  if (leaf) {
    const wrapId = render(`<Frame name="${WRAP}" flex="row">\n${node.jsx}\n</Frame>`);
    const childId = JSON.parse(evalCode(`const w=await figma.getNodeByIdAsync(${JSON.stringify(wrapId)}); JSON.stringify(w.children[0].id)`));
    if (parent) moveInto(childId, parent, node.jsx);
    removeIds([wrapId]);
    return childId;
  }
  const id = render(node.jsx);
  if (parent) moveInto(id, parent, node.jsx);
  for (const child of node.children || []) walk(child, id);
  return id;
}

const started = Date.now();
try {
  const rootId = walk(tree, opt('--parent'));
  console.log(JSON.stringify({ rootId, calls, nodes: tree.count, cleanedDuplicates: cleaned, seconds: Math.round((Date.now() - started) / 1000) }));
} catch (e) {
  // Se para en la primera pieza que falla. Lo creado queda en Figma para revisarlo o borrarlo;
  // ojo: tras un fallo, figma-cli puede haber reintentado y dejado copias sueltas en la página.
  console.error(`Falló la pieza ${calls}: ${e.message}`);
  console.error(`IDs creados hasta ahora: ${created.join(', ') || 'ninguno'}`);
  process.exitCode = 1;
} finally {
  rmSync(dir, { recursive: true, force: true });
}
