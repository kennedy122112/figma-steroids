#!/usr/bin/env node
// De una URL a Figma en un solo paso: abre la página con Playwright, lee el DOM con
// dom-to-figma (iconos incluidos), guarda el resultado y lo renderiza con render-tree.
//
//   node from-url.mjs <url> [--selector "main"] [--page "Desde código"] [-c <colección>]
//                     [--name "Dashboard"] [--width 1440] [--height 900] [--prefix "--color-"]
//                     [--components components.json] [--out resultado.json] [--dry-run]
//
// · Los estilos de texto se leen del archivo de Figma abierto (sin --dry-run o con conexión).
// · --components: JSON con [{ selector, component, variant }] → instancias de Figma.
// · --dry-run: solo lee la página y guarda el resultado, sin tocar Figma.
// · Usa Edge o Chrome instalados (o el Chromium de Playwright). Necesita `playwright` o
//   `playwright-core` en el proyecto, en esta carpeta o global (`npm i -g playwright-core`).
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const valued = ['--selector', '--page', '-c', '--collection', '--name', '--width', '--height', '--prefix', '--components', '--out'];
const url = args.find((a, i) => !a.startsWith('-') && !valued.includes(args[i - 1]));
const opt = (...names) => {
  const i = args.findIndex((a) => names.includes(a));
  return i >= 0 ? args[i + 1] : undefined;
};
const flag = (name) => args.includes(name);
if (!url) {
  console.error('Uso: node from-url.mjs <url> [--selector "main"] [--page "<página>"] [-c <colección>] [--dry-run]');
  process.exit(1);
}

const cli = process.env.FIGMA_CLI || 'figma-cli';
const dryRun = flag('--dry-run');
const out = resolve(opt('--out') || join(tmpdir(), `figma-from-url-${Date.now()}.json`));

// playwright / playwright-core: del proyecto actual, de esta carpeta o de los paquetes globales.
async function loadPlaywright() {
  const bases = [join(process.cwd(), 'x.js'), join(here, 'x.js')];
  try { bases.push(join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'x.js')); } catch (e) { /* sin npm */ }
  for (const base of bases) {
    for (const name of ['playwright', 'playwright-core']) {
      try {
        const path = createRequire(base).resolve(name);
        const mod = await import(pathToFileURL(path).href);
        return mod.chromium ? mod : mod.default;
      } catch (e) { /* siguiente */ }
    }
  }
  console.error('Falta Playwright. Instálalo en el proyecto (npm i -D playwright-core) o global (npm i -g playwright-core).');
  process.exit(1);
}

async function launch(chromium) {
  for (const channel of ['msedge', 'chrome', undefined]) {
    try { return await chromium.launch(channel ? { channel } : {}); } catch (e) { /* siguiente */ }
  }
  console.error('No se encontró Edge, Chrome ni el Chromium de Playwright (npx playwright install chromium).');
  process.exit(1);
}

function evalFigma(code) {
  const f = join(tmpdir(), `from-url-${Date.now()}.js`);
  writeFileSync(f, code);
  return execSync(`${cli} eval -f "${f}"`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim().split('\n').pop();
}

// Los estilos de texto del archivo, para que los textos usen textStyle en vez de valores sueltos.
function textStyles() {
  if (dryRun) return [];
  try {
    return JSON.parse(evalFigma('const s=await figma.getLocalTextStylesAsync(); JSON.stringify(s.map(t=>({name:t.name,size:t.fontSize,weight:({"Thin":100,"Light":300,"Regular":400,"Medium":500,"Semi Bold":600,"Bold":700,"Extra Bold":800,"Black":900})[t.fontName.style]||400,lineHeight:t.lineHeight.unit==="PIXELS"?t.lineHeight.value:null})))'));
  } catch (e) {
    console.error('No se pudo leer Figma: ¿está conectado (figma-cli connect --safe)?');
    process.exit(1);
  }
}

const opts = {
  name: opt('--name'),
  tokenPrefix: opt('--prefix'),
  textStyles: textStyles(),
  components: opt('--components') ? JSON.parse(readFileSync(opt('--components'), 'utf8')) : [],
};

const chromium = (await loadPlaywright()).chromium;
const browser = await launch(chromium);
let result;
try {
  const page = await browser.newPage({ viewport: { width: +(opt('--width') || 1440), height: +(opt('--height') || 900) } });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.addScriptTag({ path: join(here, 'dom-to-figma.js') });
  result = await page.evaluate(async ({ selector, opts }) => {
    await document.fonts.ready;
    document.getAnimations().forEach((a) => { try { a.finish(); } catch (e) { /* infinita */ } });
    const target = document.querySelector(selector);
    if (!target) return { error: `No hay ningún elemento "${selector}" en la página.` };
    if (!opts.name) opts.name = document.title || selector;
    const r = await window.domToFigmaAsync(target, opts);
    return { jsx: r.jsx, tree: r.tree, report: r.report, svgs: r.svgs };
  }, { selector: opt('--selector') || 'body', opts });
} finally {
  await browser.close();
}
if (result.error) {
  console.error(result.error);
  process.exit(1);
}
writeFileSync(out, JSON.stringify(result));

const r = result.report;
const summary = {
  out,
  nodes: r.nodes,
  icons: r.icons,
  unmappedColors: r.unmappedColors,
  rawText: (r.rawText || []).length,
};
if (dryRun) {
  console.log(JSON.stringify(summary, null, 2));
  process.exit(0);
}

const renderArgs = [join(here, 'render-tree.mjs'), out];
if (opt('--page')) renderArgs.push('--page', opt('--page'));
const col = opt('-c', '--collection');
if (col) renderArgs.push('-c', col);
const render = spawnSync(process.execPath, renderArgs, { encoding: 'utf8', env: process.env });
process.stderr.write(render.stderr || '');
if (render.status !== 0) process.exit(render.status || 1);
console.log(JSON.stringify({ ...summary, render: JSON.parse(render.stdout.trim().split('\n').pop()) }, null, 2));
