// Ayudas compartidas de los scripts de la auditoría: hablar con Figma por figma-cli y repartir el
// trabajo en lotes. El plugin corta cada llamada a los 25 s y figma-cli corta cada resultado a
// 20 000 caracteres: en un archivo grande, recorrerlo todo en una sola llamada se queda a medias.
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';

const cli = () => process.env.FIGMA_CLI || 'figma-cli';
let runner = null;

// Para las pruebas: sustituye figma-cli por una función (código → salida de texto, o su promesa).
export function setRunner(fn) {
  runner = fn;
}

function run(code) {
  if (runner) return runner(code);
  const dir = mkdtempSync(join(tmpdir(), 'fs-audit-'));
  try {
    const f = join(dir, 'code.js');
    writeFileSync(f, code);
    try {
      return execSync(`${cli()} eval -f "${f}"`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 26 });
    } catch (e) {
      return `${e.stdout || ''}${e.stderr || ''}`;
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// Ejecuta código de la Plugin API y devuelve el objeto JSON del final. figma-cli eval devuelve lo
// que va tras el último ";": el código debe terminar en "; JSON.stringify(…)".
export async function figmaEval(code) {
  const raw = await run(code);
  const json = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
  try {
    return JSON.parse(json);
  } catch {
    throw new Error(`figma-cli no devolvió lo esperado:\n${String(raw).slice(0, 2000)}`);
  }
}

// Como figmaEval, para resultados que pueden pasar de 20 000 caracteres: el código deja su
// resultado en una constante `result`; se guarda en memoria del plugin y se lee por partes.
const PART = 15000;
export async function figmaEvalLarge(code) {
  const { length } = await figmaEval(`${code}
globalThis.__fsOut = JSON.stringify(result);
JSON.stringify({ length: globalThis.__fsOut.length })`);
  let text = '';
  for (let i = 0; i < length; i += PART) {
    text += (await figmaEval(`JSON.stringify({ part: globalThis.__fsOut.slice(${i}, ${i + PART}) })`)).part;
  }
  await figmaEval('globalThis.__fsOut = null; JSON.stringify({ ok: true })');
  return JSON.parse(text);
}

// Lotes: grupos de hasta `size` elementos de primer nivel (pantallas) por página. Devuelve
// { pages: [nombres], list: [{ page, ids }] }. Con `page`, solo esa página.
export async function batches({ page = null, size = 15 } = {}) {
  const { pages } = await figmaEval(`
const out = [];
for (const p of figma.root.children) {
  if (${JSON.stringify(page)} && p.name !== ${JSON.stringify(page)}) continue;
  await p.loadAsync();
  out.push({ name: p.name, ids: p.children.map((c) => c.id) });
};
JSON.stringify({ pages: out })`);
  const list = [];
  for (const p of pages) for (let i = 0; i < p.ids.length; i += size) list.push({ page: p.name, ids: p.ids.slice(i, i + size) });
  return { pages: pages.map((p) => p.name), list };
}

// Une los grupos { clave: { …, count, examples } } de varios lotes: suma las cuentas y guarda
// como mucho `max` ejemplos.
export function mergeGroups(target, part, max = 5) {
  for (const [key, g] of Object.entries(part || {})) {
    const t = target[key];
    if (!t) target[key] = { ...g, examples: g.examples.slice(0, max) };
    else {
      t.count += g.count;
      for (const e of g.examples) if (t.examples.length < max) t.examples.push(e);
    }
  }
  return target;
}

export function sumInto(target, part) {
  for (const [k, v] of Object.entries(part || {})) target[k] = (target[k] || 0) + v;
  return target;
}
