// Figma simulado para probar sin Figma Desktop los scripts que corren dentro del plugin.
// Implementa solo la parte de la Plugin API que usan esos scripts, con el mismo comportamiento
// que importa: fills devuelve copias, las variables se vinculan con alias, las páginas se cargan
// con loadAsync, figma.mixed es un símbolo…
//
// makeRunner(figma) imita a `figma-cli eval`: ejecuta el código con `figma` a mano y devuelve lo
// que va tras el último ";".

const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;

export const rgb = (hex, a = 1) => ({ r: parseInt(hex.slice(1, 3), 16) / 255, g: parseInt(hex.slice(3, 5), 16) / 255, b: parseInt(hex.slice(5, 7), 16) / 255, a });
export const solid = (hex, opacity = 1) => ({ type: 'SOLID', color: (({ r, g, b }) => ({ r, g, b }))(rgb(hex)), opacity, visible: true });

export function createFigma({ name = 'Archivo de prueba', pages = [], collections = [], variables = [], textStyles = [] } = {}) {
  let seq = 1000;
  const nextId = () => `${++seq}:1`;
  const mixed = Symbol('mixed');
  const byId = new Map();
  const undo = { commits: 0 };

  const alias = (v) => ({ type: 'VARIABLE_ALIAS', id: v.id });

  const METHODS = new Set(['resize', 'setBoundVariable', 'setTextStyleIdAsync', 'getRangeAllFontNames', 'getMainComponentAsync', 'createInstance', 'setReactionsAsync', 'clone', 'remove', 'appendChild', 'insertChild', 'findAll', 'findOne', 'findAllWithCriteria', 'loadAsync']);

  // Copia "plana" de un nodo, para clonarlo o instanciarlo.
  function toSpec(n) {
    const spec = {};
    for (const k of Object.keys(n)) {
      if (['id', 'parent', 'children', 'fills', 'strokes', 'removed'].includes(k) || METHODS.has(k)) continue;
      spec[k] = n[k] === undefined ? undefined : JSON.parse(JSON.stringify(n[k]));
    }
    spec.fills = n.fills.map((p) => JSON.parse(JSON.stringify(p)));
    spec.strokes = n.strokes.map((p) => JSON.parse(JSON.stringify(p)));
    if (n.children) spec.children = n.children.map(toSpec);
    return spec;
  }

  function detach(c) {
    if (c.parent && c.parent.children) {
      const i = c.parent.children.indexOf(c);
      if (i >= 0) c.parent.children.splice(i, 1);
    }
  }

  // Métodos de árbol, comunes a nodos y páginas.
  function treeMethods(n) {
    n.appendChild = (c) => { detach(c); n.children.push(c); c.parent = n; };
    n.insertChild = (i, c) => { detach(c); n.children.splice(i, 0, c); c.parent = n; };
    n.findAll = (pred = () => true) => findAll(n, pred);
    n.findOne = (pred) => findAll(n, pred)[0] || null;
  }

  function makeNode(spec, parent) {
    const { children = [], fills = [], strokes = [], ...rest } = spec;
    const n = {
      id: spec.id || nextId(),
      name: spec.type,
      width: 100,
      height: 100,
      boundVariables: {},
      reactions: [],
      ...rest,
      parent,
    };
    n.boundVariables = JSON.parse(JSON.stringify(n.boundVariables));
    let _fills = fills.map((p) => ({ ...p }));
    let _strokes = strokes.map((p) => ({ ...p }));
    const syncBound = (prop, paints) => {
      const b = paints.map((p) => (p.boundVariables && p.boundVariables.color) || undefined);
      if (b.some(Boolean)) n.boundVariables[prop] = b;
      else delete n.boundVariables[prop];
    };
    Object.defineProperty(n, 'fills', { enumerable: true, get: () => Object.freeze(_fills.map((p) => ({ ...p }))), set: (v) => { _fills = v.map((p) => ({ ...p })); syncBound('fills', _fills); } });
    Object.defineProperty(n, 'strokes', { enumerable: true, get: () => Object.freeze(_strokes.map((p) => ({ ...p }))), set: (v) => { _strokes = v.map((p) => ({ ...p })); syncBound('strokes', _strokes); } });
    syncBound('fills', _fills);
    syncBound('strokes', _strokes);
    n.setBoundVariable = (field, v) => {
      n.boundVariables[field] = alias(v);
      n[field] = Object.values(v.valuesByMode)[0];
    };
    n.setReactionsAsync = async (rs) => {
      for (const r of rs) {
        if ('action' in r && 'actions' in r) throw new Error('action y actions a la vez');
        for (const a of r.actions || []) if (a.destinationId && !byId.get(a.destinationId)) throw new Error(`destino ${a.destinationId} no existe`);
      }
      n.reactions = JSON.parse(JSON.stringify(rs));
      // Como Figma: el primer enlace de una página crea solo un punto de inicio 'Flow 1' en su pantalla.
      let top = n; while (top.parent && top.parent.type !== 'PAGE') top = top.parent;
      if (rs.length && top.parent && !top.parent.flowStartingPoints.length) top.parent.flowStartingPoints = [{ nodeId: top.id, name: 'Flow 1' }];
    };
    n.resize = (w, h) => { n.width = w; n.height = h; };
    n.clone = () => {
      const c = makeNode(toSpec(n), n.parent);
      n.parent.children.splice(n.parent.children.indexOf(n) + 1, 0, c);
      return c;
    };
    n.remove = () => {
      detach(n);
      const drop = (x) => { x.removed = true; byId.delete(x.id); (x.children || []).forEach(drop); };
      drop(n);
      n.parent = null;
    };
    if (n.type === 'INSTANCE') {
      n.getMainComponentAsync = async () => byId.get(n.mainId) || null;
    }
    if (n.type === 'COMPONENT') {
      n.createInstance = () => {
        const spec = toSpec(n);
        delete spec.reactions;
        return makeNode({ ...spec, type: 'INSTANCE', mainId: n.id }, null);
      };
    }
    if (n.type === 'COMPONENT_SET') {
      Object.defineProperty(n, 'defaultVariant', { get: () => n.children[0] });
    }
    if (n.type === 'TEXT') {
      n.textStyleId = n.textStyleId || '';
      n.letterSpacing = n.letterSpacing || { unit: 'PERCENT', value: 0 };
      n.lineHeight = n.lineHeight || { unit: 'AUTO' };
      n.textCase = n.textCase || 'ORIGINAL';
      n.textDecoration = n.textDecoration || 'NONE';
      n.characters = n.characters ?? n.name;
      n.getRangeAllFontNames = () => [n.fontName];
      n.setTextStyleIdAsync = async (id) => {
        const s = styles.find((x) => x.id === id);
        if (!s) throw new Error(`estilo ${id} no existe`);
        n.textStyleId = id;
        Object.assign(n, { fontName: { ...s.fontName }, fontSize: s.fontSize, lineHeight: { ...s.lineHeight } });
      };
    }
    if (children.length || ['FRAME', 'GROUP', 'COMPONENT', 'COMPONENT_SET', 'INSTANCE'].includes(n.type)) {
      n.children = children.map((c) => makeNode(c, n));
      treeMethods(n);
    }
    byId.set(n.id, n);
    return n;
  }

  function findAll(node, pred, out = []) {
    for (const c of node.children || []) {
      if (pred(c)) out.push(c);
      findAll(c, pred, out);
    }
    return out;
  }

  const root = { type: 'DOCUMENT', name, children: [] };
  root.children = pages.map((p) => {
    const page = { id: p.id || nextId(), type: 'PAGE', name: p.name, parent: root, loaded: false };
    // Como Figma: no admite dos puntos de inicio en la misma pantalla.
    let _starts = [];
    Object.defineProperty(page, 'flowStartingPoints', { enumerable: true, get: () => _starts.map((f) => ({ ...f })), set: (v) => {
      if (new Set(v.map((f) => f.nodeId)).size !== v.length) throw new Error('in set_flowStartingPoints: Found duplicate input nodeIds');
      _starts = v.map((f) => ({ ...f }));
    } });
    page.children = (p.children || []).map((c) => makeNode(c, page));
    page.loadAsync = async () => { page.loaded = true; };
    page.findAllWithCriteria = ({ types }) => findAll(page, (n) => types.includes(n.type));
    treeMethods(page);
    byId.set(page.id, page);
    return page;
  });
  // Instancias declaradas con { type: 'INSTANCE', of: '<nombre del componente>' }.
  const comps = [...byId.values()].filter((n) => n.type === 'COMPONENT');
  for (const n of [...byId.values()]) {
    if (n.type === 'INSTANCE' && n.of && !n.mainId) n.mainId = (comps.find((c) => c.name === n.of) || {}).id;
  }

  const cols = collections.map((c) => ({ modes: [{ modeId: `${c.id}-m1`, name: 'Mode 1' }], ...c }));
  const vars = variables.map((v) => ({ ...v }));
  const addVarMethods = (v) => {
    v.setValueForMode = (mode, value) => { v.valuesByMode[mode] = value; };
    return v;
  };
  vars.forEach(addVarMethods);

  const styles = textStyles.map((s) => ({ letterSpacing: { unit: 'PERCENT', value: 0 }, lineHeight: { unit: 'AUTO' }, textCase: 'ORIGINAL', textDecoration: 'NONE', ...s }));

  const figma = {
    mixed,
    root,
    get currentPage() { return root.children[0]; },
    getNodeByIdAsync: async (id) => byId.get(id) || null,
    commitUndo: () => { undo.commits++; },
    loadFontAsync: async () => {},
    getLocalTextStylesAsync: async () => [...styles],
    createFrame: () => makeNode({ type: 'FRAME', name: 'Frame', children: [] }, null),
    createVector: () => makeNode({ type: 'VECTOR', name: 'Vector' }, null),
    createEllipse: () => makeNode({ type: 'ELLIPSE', name: 'Ellipse' }, null),
    createText: () => makeNode({ type: 'TEXT', name: 'Text', characters: '', fontName: { family: 'Inter', style: 'Regular' }, fontSize: 12 }, null),
    createTextStyle: () => {
      const s = { id: `S:${nextId()}`, name: 'Estilo', fontName: { family: 'Inter', style: 'Regular' }, fontSize: 12, lineHeight: { unit: 'AUTO' }, letterSpacing: { unit: 'PERCENT', value: 0 }, textCase: 'ORIGINAL', textDecoration: 'NONE' };
      styles.push(s);
      return s;
    },
    variables: {
      getLocalVariableCollectionsAsync: async () => [...cols],
      getLocalVariablesAsync: async () => [...vars],
      getVariableByIdAsync: async (id) => vars.find((v) => v.id === id) || null,
      setBoundVariableForPaint: (paint, field, v) => ({ ...paint, boundVariables: { ...(paint.boundVariables || {}), [field]: alias(v) } }),
      createVariableCollection: (colName) => {
        const c = { id: `VC:${nextId()}`, name: colName, modes: [{ modeId: `m-${seq}`, name: 'Mode 1' }] };
        cols.push(c);
        return c;
      },
      createVariable: (varName, col, type) => {
        const v = addVarMethods({ id: `V:${nextId()}`, name: varName, variableCollectionId: col.id, resolvedType: type, valuesByMode: {} });
        vars.push(v);
        return v;
      },
    },
  };
  return { figma, undo, byId, styles, vars, cols };
}

// Imita a `figma-cli eval`: devuelve (como texto) el valor de la expresión tras el último ";".
export function makeRunner(figma) {
  const calls = [];
  const runner = async (code) => {
    calls.push(code);
    const i = code.lastIndexOf(';');
    const body = code.slice(0, i + 1);
    const expr = code.slice(i + 1).trim();
    const fn = new AsyncFunction('figma', `${body}\nreturn (${expr});`);
    const value = await fn(figma);
    return typeof value === 'string' ? value : JSON.stringify(value);
  };
  runner.calls = calls;
  return runner;
}
