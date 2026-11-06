#!/usr/bin/env node
// Crea (una sola vez por archivo) el kit de piezas de wireframe como componentes, en el aspecto
// Wire Box gris: todo en blanco con línea fina gris y textos en Roboto Regular. Si el kit ya existe
// en la página, lo reutiliza. Devuelve { kit: { "<nombre>": "<id del componente>" } }.
//
//   node kit.mjs
//
// Piezas: Botón, Botón principal, Campo, Tarjeta, Fila, Imagen, Visor de cámara, Barra superior,
// Pestañas, Chip, Avatar. Todas con auto-layout; las de ancho completo usan 320 px y en las
// pantallas se estiran.
import { figmaEval, FIGMA_HELPERS } from './lib.mjs';

export const KIT_CODE = `${FIGMA_HELPERS}
const page = figma.currentPage;
let holder = page.children.find((c) => c.name === 'Kit de wireframe');
const kit = {};
if (holder) {
  for (const c of holder.findAll((n) => n.type === 'COMPONENT')) kit[c.name.replace(/^WF\\//, '')] = c.id;
} else {
  holder = box('Kit de wireframe', 'col', { gap: 32, p: 40, items: 'start' });
  holder.fills = [solid(P.soft)];
  page.appendChild(holder);
  const make = (node) => { holder.appendChild(node); const c = figma.createComponentFromNode(node); kit[c.name.replace(/^WF\\//, '')] = c.id; return c; };
  const fixW = (f, w) => { f.counterAxisSizingMode = 'FIXED'; f.resize(w, f.height); };
  const fixH = (f, h) => { f.counterAxisSizingMode = 'FIXED'; f.resize(f.width, h); };

  // Botones (el principal, con línea doble y fondo gris claro, para que destaque)
  for (const [name, main] of [['Botón', false], ['Botón principal', true]]) {
    const b = box('WF/' + name, 'row', { px: 24, fill: main ? P.soft : P.paper, radius: 8, justify: 'center', strokeWeight: main ? 2 : 1 });
    b.appendChild(txt(main ? 'Acción principal' : 'Acción', 16, { name: 'texto' }));
    fixH(b, 48);
    make(b);
  }
  // Campo de formulario: etiqueta y caja
  {
    const c = box('WF/Campo', 'col', { gap: 6, items: 'start' });
    c.appendChild(txt('Etiqueta', 13, { muted: true, name: 'etiqueta' }));
    const caja = box('caja', 'row', { px: 14, fill: P.paper, radius: 6 });
    caja.appendChild(txt('Escribe aquí', 15, { muted: true, name: 'valor' }));
    c.appendChild(caja);
    fixW(c, 320);
    caja.layoutSizingHorizontal = 'FILL'; caja.counterAxisSizingMode = 'FIXED'; caja.resize(caja.width, 48);
    make(c);
  }
  // Tarjeta: título y texto
  {
    const t = box('WF/Tarjeta', 'col', { gap: 6, p: 16, fill: P.paper, radius: 10, items: 'start' });
    t.appendChild(txt('Título', 16, { name: 'título' }));
    const d = txt('Descripción breve del contenido de esta tarjeta.', 13, { muted: true, name: 'detalle' });
    t.appendChild(d);
    fixW(t, 320);
    d.layoutSizingHorizontal = 'FILL'; d.textAutoResize = 'HEIGHT';
    make(t);
  }
  // Fila de lista: avatar, dos textos y flecha
  {
    const f = box('WF/Fila', 'row', { gap: 12, px: 16, py: 12, fill: P.paper, radius: 10 });
    const a = figma.createEllipse(); a.resize(40, 40); a.fills = [solid(P.paper)]; a.strokes = [solid(P.ink)]; a.name = 'avatar';
    f.appendChild(a);
    const col = box('textos', 'col', { gap: 2, items: 'start' });
    col.appendChild(txt('Título', 15, { name: 'título' }));
    col.appendChild(txt('Detalle', 13, { muted: true, name: 'detalle' }));
    f.appendChild(col);
    f.appendChild(txt('›', 22, { name: 'flecha' }));
    f.primaryAxisSizingMode = 'FIXED'; f.resize(320, f.height);
    col.layoutSizingHorizontal = 'FILL';
    make(f);
  }
  // Imagen: caja gris con una X que escala con la caja
  {
    const im = figma.createFrame(); im.name = 'WF/Imagen'; im.resize(160, 120);
    im.fills = [solid(P.soft)]; im.strokes = [solid(P.ink)]; im.strokeWeight = 1;
    for (const d of ['M 0 0 L 160 120', 'M 0 120 L 160 0']) {
      const l = figma.createVector(); l.vectorPaths = [{ windingRule: 'NONE', data: d }];
      l.strokes = [solid(P.ink, 0.5)]; l.strokeWeight = 1; im.appendChild(l); l.x = 0; l.y = 0;
      l.constraints = { horizontal: 'SCALE', vertical: 'SCALE' };
    }
    make(im);
  }
  // Visor de cámara: marco con la guía ovalada del rostro
  {
    const v = box('WF/Visor de cámara', 'col', { fill: P.soft, radius: 16, justify: 'center' });
    v.primaryAxisSizingMode = 'FIXED'; v.counterAxisSizingMode = 'FIXED'; v.resize(280, 320);
    const o = figma.createEllipse(); o.name = 'guía del rostro'; o.resize(170, 220);
    o.fills = []; o.strokes = [solid(P.ink)]; o.strokeWeight = 2; o.dashPattern = [8, 6];
    v.appendChild(o);
    make(v);
  }
  // Barra superior: volver, título y ayuda
  {
    const b = box('WF/Barra superior', 'row', { gap: 12, px: 16, fill: P.paper });
    b.appendChild(txt('‹', 24, { name: 'volver' }));
    const t = txt('Título', 17, { name: 'título' }); b.appendChild(t);
    b.appendChild(txt('?', 18, { name: 'ayuda' }));
    b.primaryAxisSizingMode = 'FIXED'; b.resize(390, 56); fixH(b, 56);
    t.layoutGrow = 1;
    make(b);
  }
  // Pestañas inferiores
  {
    const p = box('WF/Pestañas', 'row', { px: 24, fill: P.paper, justify: 'between' });
    for (const name of ['Inicio', 'Historial', 'Justificar', 'Perfil']) {
      const it = box('pestaña', 'col', { gap: 4 });
      const dot = figma.createEllipse(); dot.resize(22, 22); dot.fills = []; dot.strokes = [solid(P.ink)]; dot.name = 'icono';
      it.appendChild(dot); it.appendChild(txt(name, 11, { name: 'texto' }));
      p.appendChild(it);
    }
    p.primaryAxisSizingMode = 'FIXED'; p.resize(390, 64); fixH(p, 64);
    make(p);
  }
  // Chip de estado
  {
    const c = box('WF/Chip', 'row', { px: 12, fill: P.paper, radius: 14 });
    c.appendChild(txt('Estado', 12, { name: 'texto' }));
    fixH(c, 28);
    make(c);
  }
  // Avatar
  {
    const a = figma.createEllipse(); a.name = 'WF/Avatar'; a.resize(64, 64); a.fills = [solid(P.paper)]; a.strokes = [solid(P.ink)];
    const f = box('WF/Avatar', 'row', {}); f.appendChild(a); a.name = 'círculo';
    make(f);
  }
  holder.x = -holder.width - 200; holder.y = 0;
  figma.commitUndo();
};
JSON.stringify({ kit })`;

if (process.argv[1] && process.argv[1].endsWith('kit.mjs')) {
  console.log(JSON.stringify(figmaEval(KIT_CODE), null, 2));
}
