// Auditoría y resolve contra un Figma simulado: lotes, unión de resultados, --fix idempotente.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createFigma, makeRunner, rgb, solid } from './helpers/figma-mock.mjs';
import { setRunner, figmaEvalLarge, mergeGroups } from '../skills/figma-consistency-audit/scripts/lib.mjs';
import { audit } from '../skills/figma-consistency-audit/scripts/audit.mjs';
import { resolve, parseArgs } from '../skills/figma-consistency-audit/scripts/resolve.mjs';

// Una pantalla: frame azul con auto-layout (gap 16 en escala, padding 13 fuera), un texto que
// coincide con el estilo Body, un título sin estilo, una tarjeta blanca (ambigua: bg y surface),
// un "Button" dibujado a mano y una instancia (no se recorre).
function screen(i) {
  return {
    type: 'FRAME', name: `Pantalla ${i}`, width: 390, height: 800, fills: [solid('#3366ff')],
    layoutMode: 'VERTICAL', itemSpacing: 16, paddingTop: 13, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, primaryAxisAlignItems: 'MIN', cornerRadius: 8,
    children: [
      { type: 'TEXT', name: 'Texto', fontName: { family: 'Inter', style: 'Regular' }, fontSize: 14, lineHeight: { unit: 'PIXELS', value: 20 } },
      { type: 'TEXT', name: 'Título', fontName: { family: 'Inter', style: 'Bold' }, fontSize: 18 },
      { type: 'FRAME', name: 'Tarjeta', fills: [solid('#ffffff')], layoutMode: 'NONE' },
      { type: 'FRAME', name: 'Button', width: 120, height: 40, fills: [solid('#3366ff')], layoutMode: 'NONE', cornerRadius: 8 },
      { type: 'INSTANCE', name: 'Icono', fills: [solid('#123456')] },
    ],
  };
}

function file() {
  return createFigma({
    pages: [
      { name: 'Pantallas', children: Array.from({ length: 20 }, (_, i) => screen(i + 1)) },
      { name: 'Otra', children: [screen(21)] },
    ],
    collections: [{ id: 'C1', name: 'Tokens' }, { id: 'C2', name: 'Tokens · Dark' }],
    variables: [
      { id: 'V1', name: 'primary', resolvedType: 'COLOR', variableCollectionId: 'C1', valuesByMode: { m: rgb('#3366ff') } },
      { id: 'V2', name: 'bg', resolvedType: 'COLOR', variableCollectionId: 'C1', valuesByMode: { m: rgb('#ffffff') } },
      { id: 'V3', name: 'surface', resolvedType: 'COLOR', variableCollectionId: 'C1', valuesByMode: { m: { type: 'VARIABLE_ALIAS', id: 'V2' } } },
      { id: 'V4', name: 'spacing/16', resolvedType: 'FLOAT', variableCollectionId: 'C1', valuesByMode: { m: 16 } },
      { id: 'V5', name: 'radius/md', resolvedType: 'FLOAT', variableCollectionId: 'C1', valuesByMode: { m: 8 } },
      // Del tema oscuro: mismo azul con otro nombre; no debe volver ambiguo a "primary".
      { id: 'V6', name: 'card', resolvedType: 'COLOR', variableCollectionId: 'C2', valuesByMode: { m: rgb('#3366ff') } },
    ],
    textStyles: [{ id: 'S:1', name: 'Body', fontName: { family: 'Inter', style: 'Regular' }, fontSize: 14, lineHeight: { unit: 'PIXELS', value: 20 } }],
  });
}

let fx, runner;
beforeEach(() => {
  fx = file();
  runner = makeRunner(fx.figma);
  setRunner(runner);
});

test('audit reparte el archivo en lotes y une los resultados', async () => {
  const r = await audit({ size: 15 });
  assert.equal(r.batches, 3); // 20 pantallas → 15 + 5, y 1 en la otra página
  assert.deepEqual(r.pages, ['Pantallas', 'Otra']);
  assert.equal(r.nodes, 21 * 5); // la instancia no cuenta
  const blue = r.colors.find((c) => c.value === '#3366ff');
  assert.equal(blue.count, 42);
  assert.equal(blue.token, 'primary');
  assert.equal(blue.examples.length, 5);
  assert.equal(r.colors.find((c) => c.value === '#ffffff').token, 'ambiguo: bg | surface');
  assert.ok(!r.colors.some((c) => c.value === '#123456'), 'no entra en instancias');
  assert.equal(r.spacing.find((s) => s.value === 13).count, 21);
  assert.equal(r.spacing.find((s) => s.value === 16).token, 'spacing/16');
  assert.equal(r.text.find((t) => t.value === 'Inter Regular 14/20').style, 'Body');
  assert.equal(r.handmade[0].count, 21);
  assert.equal(r.coverage.colors, '0% (0/63)');
  assert.equal(r.fixed, null);
  assert.equal(fx.undo.commits, 0, 'sin --fix no toca nada');
});

test('el mismo resultado con un lote o con muchos', async () => {
  const one = await audit({ size: 100 });
  const many = await audit({ size: 2 });
  assert.equal(one.batches, 2);
  assert.equal(many.batches, 11);
  for (const k of ['nodes', 'coverage', 'system', 'pages']) assert.deepEqual(many[k], one[k]);
  for (const k of ['colors', 'text', 'spacing', 'radius', 'handmade']) {
    assert.deepEqual(many[k].map((g) => [g.value ?? g.kind, g.count]), one[k].map((g) => [g.value ?? g.kind, g.count]));
  }
});

test('--page limita el recorrido a esa página', async () => {
  const r = await audit({ page: 'Otra' });
  assert.deepEqual(r.pages, ['Otra']);
  assert.equal(r.nodes, 5);
});

test('--fix vincula solo lo exacto y no ambiguo, y repetirlo no hace nada', async () => {
  const r = await audit({ fix: true, size: 15 });
  assert.deepEqual(r.fixed, { color: 42, text: 21, spacing: 21, radius: 42 });
  const s = fx.byId.get(fx.figma.root.children[0].children[0].id);
  assert.deepEqual(s.boundVariables.fills, [{ type: 'VARIABLE_ALIAS', id: 'V1' }]);
  assert.deepEqual(s.boundVariables.itemSpacing, { type: 'VARIABLE_ALIAS', id: 'V4' });
  assert.equal(s.boundVariables.paddingTop, undefined, '13 no está en la escala');
  assert.equal(s.children[0].textStyleId, 'S:1');
  assert.equal(s.children[1].textStyleId, '', 'sin estilo exacto no se toca');
  assert.equal(s.children[2].boundVariables.fills, undefined, 'el blanco es ambiguo');
  assert.equal(fx.undo.commits, 3, 'un commitUndo por lote');

  const again = await audit({ fix: true });
  assert.deepEqual(again.fixed, { color: 0, text: 0, spacing: 0, radius: 0 });
  assert.equal(again.coverage.colors, '67% (42/63)');
});

test('no aplica un estilo si el interletrado no coincide', async () => {
  const t = fx.figma.root.children[1].children[0].children[0];
  t.letterSpacing = { unit: 'PERCENT', value: 5 };
  const r = await audit({ page: 'Otra', fix: true });
  assert.equal(r.fixed.text, 0);
  assert.equal(t.textStyleId, '');
});

test('figmaEvalLarge lee por partes un resultado de más de 20 000 caracteres', async () => {
  runner.calls.length = 0;
  const r = await figmaEvalLarge("const result = { s: 'x'.repeat(40000) };");
  assert.equal(r.s.length, 40000);
  assert.equal(runner.calls.filter((c) => c.includes('__fsOut.slice(')).length, 3);
  assert.equal(globalThis.__fsOut, null, 'libera la memoria del plugin');
});

test('mergeGroups suma cuentas y guarda como mucho 5 ejemplos', () => {
  const t = mergeGroups({}, { a: { value: 1, count: 3, examples: [1, 2, 3] } });
  mergeGroups(t, { a: { value: 1, count: 4, examples: [4, 5, 6, 7] }, b: { value: 2, count: 1, examples: [9] } });
  assert.deepEqual(t, { a: { value: 1, count: 7, examples: [1, 2, 3, 4, 5] }, b: { value: 2, count: 1, examples: [9] } });
});

test('resolve --dry-run informa sin cambiar nada', async () => {
  const { ops } = parseArgs(['--add-spacing', '13', '--text', 'Inter Bold 18=Heading', '--color', '#ffffff=bg', '--dry-run']);
  const r = await resolve({ ops, dry: true, size: 15 });
  assert.equal(r.batches, 3);
  assert.deepEqual(r.added, ['spacing/13 = 13']);
  assert.equal(r.spacing['13 → spacing/13 (13)'].count, 21);
  assert.equal(r.texts['Inter Bold 18 → Heading'].count, 21);
  assert.equal(r.colors['#ffffff → bg'].count, 21);
  assert.deepEqual(r.createdStyles, ['Heading (se crearía)']);
  assert.ok(!fx.vars.some((v) => v.name === 'spacing/13'));
  assert.equal(fx.styles.length, 1);
  assert.equal(fx.undo.commits, 0);
});

test('resolve aplica en lotes y es idempotente', async () => {
  const { ops } = parseArgs(['--add-spacing', '13', '--text', 'Inter Bold 18=Heading', '--color', '#ffffff=bg']);
  const r = await resolve({ ops, size: 15 });
  assert.equal(r.spacing['13 → spacing/13 (13)'].count, 21);
  assert.deepEqual(r.createdStyles, ['Heading']);
  const v13 = fx.vars.find((v) => v.name === 'spacing/13');
  assert.equal(v13.variableCollectionId, 'C1', 'en la colección de la escala');
  const s = fx.figma.root.children[0].children[0];
  assert.deepEqual(s.boundVariables.paddingTop, { type: 'VARIABLE_ALIAS', id: v13.id });
  assert.equal(s.children[1].textStyleId, fx.styles.find((x) => x.name === 'Heading').id);
  assert.deepEqual(s.children[2].boundVariables.fills, [{ type: 'VARIABLE_ALIAS', id: 'V2' }]);

  const again = await resolve({ ops, size: 15 });
  assert.deepEqual(again.added, []);
  assert.deepEqual(again.createdStyles, []);
  assert.deepEqual(again.spacing, {});
  assert.deepEqual(again.texts, {});
  assert.deepEqual(again.colors, {});
  assert.equal(fx.vars.filter((v) => v.name === 'spacing/13').length, 1);
});

test('resolve --round-spacing respeta --max-delta', async () => {
  let r = await resolve({ ops: parseArgs(['--round-spacing']).ops, dry: true });
  assert.deepEqual(r.spacing, {}, '13 → 16 son 3 px, más que 2');
  r = await resolve({ ops: parseArgs(['--round-spacing', '--max-delta', '3']).ops, dry: true });
  assert.equal(r.spacing['13 → spacing/16 (16)'].count, 21);
});

test('resolve sin opciones explica qué hacer', async () => {
  await assert.rejects(resolve({ ops: parseArgs([]).ops }), /Nada que resolver/);
});
