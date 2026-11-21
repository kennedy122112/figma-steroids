// De wireframe a alta fidelidad contra un Figma simulado.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createFigma, makeRunner, rgb, solid } from './helpers/figma-mock.mjs';
import { setRunner } from '../skills/figma-wireframe/scripts/lib.mjs';
import { hifi, SUFFIX } from '../skills/figma-wireframe/scripts/hifi.mjs';

const INK = '#4b5563';
const txt = (characters, size = 15, opacity = 1) => ({ type: 'TEXT', name: characters, characters, fontName: { family: 'Roboto', style: 'Regular' }, fontSize: size, fills: [solid(INK, opacity)] });
const kitPiece = (name, texts) => ({ type: 'COMPONENT', name: `WF/${name}`, fills: [solid('#ffffff')], strokes: [solid(INK)], layoutMode: 'HORIZONTAL', children: texts.map((t) => txt(t)) });
const wf = (name, texts, extra = {}) => ({ type: 'INSTANCE', of: `WF/${name}`, name: `WF/${name}`, fills: [solid('#ffffff')], strokes: [solid(INK)], layoutMode: 'HORIZONTAL', children: texts.map((t) => txt(t)), ...extra });
const variant = (name, label) => ({ type: 'COMPONENT', name, layoutMode: 'HORIZONTAL', children: [{ type: 'TEXT', name: 'label', characters: label, fontName: { family: 'Inter', style: 'Medium' }, fontSize: 14 }] });

function file({ system = true } = {}) {
  const fx = createFigma({
    pages: [
      {
        name: 'Wireframes',
        children: [
          { type: 'FRAME', name: 'Kit de wireframe', layoutMode: 'VERTICAL', children: [
            kitPiece('Botón principal', ['Acción principal']), kitPiece('Botón', ['Acción']), kitPiece('Imagen', []),
            kitPiece('Barra superior', ['‹', 'Título', '?']), kitPiece('Tarjeta', ['Título', 'Detalle']),
          ] },
          { id: '1:1', type: 'FRAME', name: '1 · Inicio', x: 0, y: 0, width: 390, height: 844, fills: [solid('#ffffff')], layoutMode: 'VERTICAL', itemSpacing: 16, paddingTop: 20, paddingBottom: 0, paddingLeft: 0, paddingRight: 0, children: [
            wf('Barra superior', ['‹', 'Asistencia', '?'], { layoutSizingHorizontal: 'FILL' }),
            txt('Hola, Ana', 24),
            txt('Turno de 8:00 a 17:00', 13, 0.65),
            wf('Botón principal', ['Marcar entrada'], { id: '1:10', layoutSizingHorizontal: 'FILL', reactions: [{ trigger: { type: 'ON_CLICK' }, actions: [{ type: 'NODE', destinationId: '2:1', navigation: 'NAVIGATE' }] }] }),
            wf('Botón', ['Ver historial']),
            { type: 'FRAME', name: 'tarjeta', fills: [solid('#ffffff')], strokes: [solid(INK)], cornerRadius: 10, width: 350, height: 80, layoutMode: 'VERTICAL', itemSpacing: 6, children: [txt('Sede Central')] },
            wf('Imagen', [], { fills: [solid('#f3f4f6')] }),
          ] },
          { id: '2:1', type: 'FRAME', name: '2 · Verificando', x: 550, y: 0, width: 390, height: 844, fills: [solid('#ffffff')], layoutMode: 'VERTICAL', children: [
            wf('Botón principal', ['Volver'], { reactions: [{ trigger: { type: 'ON_CLICK' }, actions: [{ type: 'NODE', destinationId: '1:1', navigation: 'NAVIGATE' }] }] }),
          ] },
        ],
      },
      {
        name: 'Componentes',
        children: system ? [
          { type: 'COMPONENT_SET', name: 'Button', children: [variant('Variant=Default, Size=Default', 'Button'), variant('Variant=Default, Size=Disabled', 'Button'), variant('Variant=Outline, Size=Default', 'Button')] },
          { type: 'COMPONENT', name: 'Button Group', children: [] },
          { type: 'COMPONENT', name: 'Icon/Button', children: [] },
          { type: 'COMPONENT', name: 'Card', children: [{ type: 'TEXT', name: 't', characters: 'Card title', fontName: { family: 'Inter', style: 'Semi Bold' }, fontSize: 16 }, { type: 'TEXT', name: 'd', characters: 'Card description', fontName: { family: 'Inter', style: 'Regular' }, fontSize: 14 }] },
        ] : [],
      },
    ],
    collections: system ? [{ id: 'C1', name: 'Tokens' }, { id: 'C2', name: 'Tokens · Dark' }] : [],
    variables: system ? [
      ...['background', 'card', 'muted', 'foreground', 'muted-foreground', 'border'].map((n, i) => ({ id: `V${i}`, name: `color/${n}`, resolvedType: 'COLOR', variableCollectionId: 'C1', valuesByMode: { m: rgb('#101010') } })),
      { id: 'VD', name: 'color/background', resolvedType: 'COLOR', variableCollectionId: 'C2', valuesByMode: { m: rgb('#000000') } },
      { id: 'S16', name: 'spacing/16', resolvedType: 'FLOAT', variableCollectionId: 'C1', valuesByMode: { m: 16 } },
      { id: 'S24', name: 'spacing/24', resolvedType: 'FLOAT', variableCollectionId: 'C1', valuesByMode: { m: 24 } },
      { id: 'R8', name: 'radius/md', resolvedType: 'FLOAT', variableCollectionId: 'C1', valuesByMode: { m: 8 } },
    ] : [],
    textStyles: system ? [
      { id: 'T1', name: 'Heading/H1', fontName: { family: 'Inter', style: 'Bold' }, fontSize: 24 },
      { id: 'T2', name: 'Body/Small', fontName: { family: 'Inter', style: 'Regular' }, fontSize: 13 },
      { id: 'T3', name: 'Body', fontName: { family: 'Inter', style: 'Regular' }, fontSize: 15 },
    ] : [],
  });
  fx.figma.root.children[0].flowStartingPoints = [{ nodeId: '1:1', name: 'Asistencia' }];
  return fx;
}

let fx;
const page = () => fx.figma.root.children[0];
const copyOf = (name) => page().children.find((c) => c.name === name + SUFFIX);
const main = async (n) => (await n.getMainComponentAsync()).name;
beforeEach(() => {
  fx = file();
  setRunner(makeRunner(fx.figma));
});

test('--dry-run enseña el plan sin tocar el archivo', async () => {
  const before = page().children.length;
  const r = await hifi({ all: true, dryRun: true });
  assert.equal(r.mapping['Botón principal'], 'Button (Variant=Default, Size=Default)');
  assert.equal(r.mapping['Botón'], 'Button (Variant=Outline, Size=Default)');
  assert.equal(r.mapping['Tarjeta'], 'Card');
  assert.equal(r.mapping['Imagen'], null);
  assert.equal(r.tokens.background, 'color/background');
  assert.equal(r.tokens.mutedForeground, 'color/muted-foreground');
  assert.deepEqual(r.screens, ['1 · Inicio', '2 · Verificando']);
  assert.equal(page().children.length, before);
});

test('crea la copia con componentes y tokens del sistema; la original no cambia', async () => {
  const r = await hifi({ all: true });
  assert.equal(r.screens.length, 2);
  const s1 = r.screens[0];
  assert.deepEqual(s1.swapped, { 'Botón principal': 1, 'Botón': 1 });
  assert.deepEqual(s1.kept, { 'Barra superior': 1, Imagen: 1 });
  assert.deepEqual(s1.errors, []);

  const orig = fx.byId.get('1:1');
  assert.equal(await main(orig.children[3]), 'WF/Botón principal', 'la original sigue en wireframe');
  const c = copyOf('1 · Inicio');
  assert.equal(c.y, 844 + 300, 'debajo de la original');

  // Mismo orden, mismo ancho, mismos textos.
  const btn = c.children[3];
  assert.equal(await main(btn), 'Variant=Default, Size=Default');
  assert.equal(btn.layoutSizingHorizontal, 'FILL');
  assert.equal(btn.children[0].characters, 'Marcar entrada');
  assert.equal(await main(c.children[4]), 'Variant=Outline, Size=Default');
  assert.equal(c.children[4].children[0].characters, 'Ver historial');

  // Colores, estilos, espaciado y radios.
  assert.deepEqual(c.boundVariables.fills, [{ type: 'VARIABLE_ALIAS', id: 'V0' }], 'fondo');
  assert.equal(c.children[1].textStyleId, 'T1');
  assert.deepEqual(c.children[1].boundVariables.fills, [{ type: 'VARIABLE_ALIAS', id: 'V3' }], 'texto');
  assert.equal(c.children[2].textStyleId, 'T2');
  assert.deepEqual(c.children[2].boundVariables.fills, [{ type: 'VARIABLE_ALIAS', id: 'V4' }], 'texto secundario');
  assert.equal(c.children[2].fills[0].opacity, 1);
  const card = c.children[5];
  assert.deepEqual(card.boundVariables.fills, [{ type: 'VARIABLE_ALIAS', id: 'V1' }], 'tarjeta');
  assert.deepEqual(card.boundVariables.strokes, [{ type: 'VARIABLE_ALIAS', id: 'V5' }], 'borde');
  assert.deepEqual(card.boundVariables.topLeftRadius, { type: 'VARIABLE_ALIAS', id: 'R8' });
  assert.equal(card.boundVariables.itemSpacing, undefined, '6 está a más de 4 px de la escala');
  assert.deepEqual(c.boundVariables.itemSpacing, { type: 'VARIABLE_ALIAS', id: 'S16' });
  assert.deepEqual(c.children[6].boundVariables.fills, [{ type: 'VARIABLE_ALIAS', id: 'V2' }], 'la imagen que queda usa "muted"');
});

test('los enlaces del prototipo pasan a las copias', async () => {
  const r = await hifi({ all: true });
  const c1 = copyOf('1 · Inicio');
  const c2 = copyOf('2 · Verificando');
  assert.equal(c1.children[3].reactions[0].actions[0].destinationId, c2.id);
  assert.equal(c2.children[0].reactions[0].actions[0].destinationId, c1.id);
  assert.equal(fx.byId.get('1:10').reactions[0].actions[0].destinationId, '2:1', 'la original sigue enlazada a la original');
  assert.equal(r.prototypeLinks, 2);
  assert.deepEqual(page().flowStartingPoints.map((f) => f.name), ['Asistencia', 'Asistencia' + SUFFIX]);
});

test('repetirlo rehace las copias sin duplicar', async () => {
  await hifi({ all: true });
  await hifi({ all: true });
  assert.equal(page().children.filter((c) => c.name.endsWith(SUFFIX)).length, 2);
  assert.equal(page().flowStartingPoints.length, 2);
});

test('--map elige a mano el componente o deja la pieza como está', async () => {
  const r = await hifi({ ids: ['1:1'], map: { 'Botón': 'Button[Variant=Default]', 'Botón principal': null, 'Tarjeta': 'No existe' } });
  assert.deepEqual(r.screens[0].swapped, { 'Botón': 1 });
  assert.equal(r.mapping['Botón'], 'Button (Variant=Default, Size=Default)');
  assert.equal(r.mapping['Tarjeta'], '✗ no encuentro No existe');
  assert.equal(await main(copyOf('1 · Inicio').children[3]), 'WF/Botón principal');
});

test('sin design system lo explica y no crea nada', async () => {
  fx = file({ system: false });
  setRunner(makeRunner(fx.figma));
  await assert.rejects(hifi({ all: true }), /no tiene design system/);
  assert.ok(!page().children.some((c) => c.name.endsWith(SUFFIX)));
});

test('con una paleta por escala (neutral/0…900) elige los grises por su valor', async () => {
  fx = file();
  // Sustituye las variables semánticas por una escala tipo Tailwind slate.
  fx.vars.length = 0;
  const scale = { 0: '#ffffff', 50: '#f8fafc', 100: '#f1f5f9', 300: '#cbd5e1', 600: '#475569', 900: '#0f172a' };
  for (const [k, hex] of Object.entries(scale)) fx.vars.push({ id: `N${k}`, name: `color/neutral/${k}`, resolvedType: 'COLOR', variableCollectionId: 'C1', valuesByMode: { m: rgb(hex) } });
  fx.vars.push({ id: 'P', name: 'color/primary/500', resolvedType: 'COLOR', variableCollectionId: 'C1', valuesByMode: { m: rgb('#e85d04') } });
  setRunner(makeRunner(fx.figma));
  const r = await hifi({ all: true, dryRun: true });
  assert.deepEqual(r.tokens, {
    background: 'color/neutral/0 (por valor)', card: 'color/neutral/0 (por valor)', muted: 'color/neutral/100 (por valor)',
    foreground: 'color/neutral/900 (por valor)', mutedForeground: 'color/neutral/600 (por valor)', border: 'color/neutral/300 (por valor)',
  });
});

test('los iconos hechos con símbolos no ocupan el hueco de un texto', async () => {
  const bar = fx.byId.get('1:1').children[0];
  bar.children[0].characters = '≡';
  // La barra se cambia por un componente con un solo hueco de texto: debe recibir "Asistencia", no "≡".
  const r = await hifi({ ids: ['1:1'], map: { 'Barra superior': 'Card' } });
  assert.equal(r.screens[0].swapped['Barra superior'], 1);
  assert.equal(copyOf('1 · Inicio').children[0].children[0].characters, 'Asistencia');
});
