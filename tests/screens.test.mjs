// Enlaces del prototipo de screens.mjs contra un Figma simulado: se rehacen aunque falle una
// pantalla, se comprueban y no se pisan entre sí.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createFigma, makeRunner, solid } from './helpers/figma-mock.mjs';
import { setRunner } from '../skills/figma-wireframe/scripts/lib.mjs';
import { buildFlow, withRetry } from '../skills/figma-wireframe/scripts/screens.mjs';

const txt = (characters) => ({ type: 'TEXT', name: characters, characters, fontName: { family: 'Roboto', style: 'Regular' }, fontSize: 15 });
const btn = (label) => ({ type: 'INSTANCE', name: 'WF/Botón', children: [txt(label)] });

// Lo que screens.mjs ya dibujó: tres pantallas con los textos de los enlaces.
function file() {
  return createFigma({
    pages: [{
      name: 'biometrico',
      children: [
        { type: 'FRAME', name: '1 · Inicio', x: 0, width: 390, height: 844, fills: [solid('#ffffff')], children: [
          btn('Marcar entrada'),
          // Una fila con dos textos enlazados: los dos enlaces van al mismo nodo.
          { type: 'FRAME', name: 'fila', children: [txt('Ver historial'), txt('Justificar')] },
        ] },
        { type: 'FRAME', name: '2 · Verificando', x: 550, width: 390, height: 844, children: [btn('Volver')] },
        { type: 'FRAME', name: '3 · Historial', x: 1100, width: 390, height: 844, children: [btn('Inicio')] },
      ],
    }],
  });
}

const spec = {
  flow: 'Asistencia',
  screens: [
    { id: 'inicio', name: '1 · Inicio', links: [{ on: 'Marcar entrada', to: 'verificando' }, { on: 'Ver historial', to: 'historial' }] },
    { id: 'verificando', name: '2 · Verificando', links: [{ on: 'Volver', to: 'inicio' }] },
    { id: 'historial', name: '3 · Historial', links: [{ on: 'Inicio', to: 'inicio' }] },
  ],
};

let fx, runner;
const page = () => fx.figma.root.children[0];
const screen = (name) => page().children.find((c) => c.name === name);
beforeEach(() => {
  fx = file();
  runner = makeRunner(fx.figma);
  setRunner(runner);
});

test('--links-only rehace enlaces, flechas, notas y punto de inicio, y los comprueba', async () => {
  const r = await buildFlow(spec, { linksOnly: true });
  assert.equal(r.expectedLinks, 4);
  assert.equal(r.prototypeLinks, 4);
  assert.equal(r.verifiedLinks, 4);
  assert.deepEqual(r.notLinked, []);
  const inicio = screen('1 · Inicio');
  assert.equal(inicio.children[0].reactions[0].actions[0].destinationId, screen('2 · Verificando').id);
  assert.deepEqual(page().flowStartingPoints, [{ nodeId: inicio.id, name: 'Asistencia' }]);
  assert.equal(page().children.filter((c) => c.name === '__flujo').length, 1);
  assert.ok(screen('__flujo').children.some((c) => c.name === 'flecha'));
  assert.ok(screen('__flujo').children.some((c) => c.name === 'lleva a'));
});

test('dos enlaces desde el mismo elemento no se pisan', async () => {
  const s = { ...spec, screens: spec.screens.map((x) => (x.id === 'inicio' ? { ...x, links: [...x.links, { on: 'Justificar', to: 'verificando' }] } : x)) };
  const r = await buildFlow(s, { linksOnly: true });
  const fila = screen('1 · Inicio').children[1];
  assert.equal(fila.reactions.length, 2, 'los dos enlaces de la fila');
  assert.equal(r.verifiedLinks, 5);
});

test('repetirlo no duplica enlaces, notas ni puntos de inicio', async () => {
  await buildFlow(spec, { linksOnly: true });
  const r = await buildFlow(spec, { linksOnly: true });
  assert.equal(r.verifiedLinks, 4);
  assert.equal(page().children.filter((c) => c.name === '__flujo').length, 1);
  assert.equal(page().flowStartingPoints.length, 1);
});

test('si falta una pantalla, enlaza las demás y dice cuál falta', async () => {
  screen('3 · Historial').remove();
  const r = await buildFlow(spec, { linksOnly: true });
  assert.deepEqual(r.missingScreens, ['3 · Historial']);
  assert.equal(r.verifiedLinks, 2);
  assert.equal(r.notLinked.length, 2);
});

test('si una pantalla no se puede dibujar, los enlaces se hacen igual', async () => {
  // Kit ya creado y pantallas que fallan siempre: como cuando el plugin corta la conexión.
  setRunner(async (code) => {
    if (code.includes("'Kit de wireframe'")) return '{"kit":{}}';
    if (code.includes('const S = {"id":"verificando"')) throw new Error('timeout del plugin');
    if (code.includes('const S = ')) return '{"id":"x","missing":[]}';
    return runner(code);
  });
  const r = await buildFlow(spec, { retry: { attempts: 2, wait: 0 } });
  assert.deepEqual(r.failedScreens, ['2 · Verificando']);
  assert.equal(r.verifiedLinks, 4, 'la pantalla que falló sigue en la página y se enlaza');
});

test('withRetry repite lo que falla y se rinde tras los intentos', async () => {
  let n = 0;
  assert.equal(await withRetry(async () => { if (++n < 3) throw new Error('x'); return 'ok'; }, { wait: 0 }), 'ok');
  assert.equal(n, 3);
  await assert.rejects(withRetry(async () => { throw new Error('siempre'); }, { attempts: 2, wait: 0 }), /siempre/);
});
