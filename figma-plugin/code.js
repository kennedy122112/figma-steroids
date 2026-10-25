/**
 * Plugin figma-steroids: puente con el daemon de figma-cli (modo Safe) con
 * registro de actividad, pausa, selección con ID y archivo conectado.
 *
 * El protocolo con el daemon es el mismo que el del plugin FigCli de figma-cli:
 * la UI abre el WebSocket y reenvía aquí los mensajes `eval` / `eval-batch`.
 * Solo se añade lo que ve el usuario; la ejecución del código no cambia.
 */

const SIZES = { collapsed: { width: 260, height: 132 }, expanded: { width: 320, height: 460 } };

figma.showUI(__html__, { ...SIZES.collapsed, position: { x: -9999, y: 9999 }, themeColors: true });

let paused = false;

// Igual que en el plugin FigCli: añade `return` a la última sentencia y limita el tiempo.
async function executeCode(code, timeoutMs = 25000) {
  let trimmed = code.trim();

  if (!trimmed.startsWith('return ')) {
    const isSimpleExpr = !trimmed.includes(';');
    const isIIFE = trimmed.startsWith('(function') || trimmed.startsWith('(async function');
    const isArrowIIFE = trimmed.startsWith('(() =>') || trimmed.startsWith('(async () =>');

    if (isSimpleExpr || isIIFE || isArrowIIFE) {
      trimmed = `return ${trimmed}`;
    } else {
      const lastSemicolon = trimmed.lastIndexOf(';');
      if (lastSemicolon !== -1) {
        const beforeLast = trimmed.substring(0, lastSemicolon + 1);
        const lastStmt = trimmed.substring(lastSemicolon + 1).trim();
        if (lastStmt && !lastStmt.startsWith('return ')) {
          trimmed = beforeLast + ' return ' + lastStmt;
        }
      }
    }
  }

  // El sandbox de Figma bloquea `new Function`; eval corre donde `figma` ya es global.
  const execPromise = eval(`(async () => { ${trimmed} })()`);
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Execution timeout (${timeoutMs / 1000}s)`)), timeoutMs)
  );

  return Promise.race([execPromise, timeoutPromise]);
}

// ---- Cambios en el documento hechos por cada comando ----
// nodechange de la página actual distingue lecturas de escrituras sin cargar todas las páginas.
// Figma lo emite entre 0,25 s (borrados) y 1 s (creaciones) después del cambio, así que no
// se espera: la respuesta sale enseguida y la UI actualiza la entrada cuando llegan los
// cambios. Cada evento se asigna al último comando que empezó al menos LAG_MS antes; pasado
// WINDOW_MS desde que terminó, se ignora (así no se cuentan las ediciones del usuario a mano).
// Si la IA lanza comandos con menos de ~1 s de separación, un cambio tardío puede contarse
// en el comando siguiente.
const LAG_MS = 100;
const WINDOW_MS = 3000;
const runs = []; // { id, start, end, changes }
let watchedPage = null;

function onNodeChange(event) {
  const now = Date.now();
  let run = null;
  for (let i = runs.length - 1; i >= 0; i--) {
    const r = runs[i];
    if (r.start <= now - LAG_MS && (r.end === undefined || now - r.end <= WINDOW_MS)) { run = r; break; }
  }
  if (!run) return;
  for (const c of event.nodeChanges) {
    if (c.type === 'CREATE') run.changes.created++;
    else if (c.type === 'DELETE') run.changes.deleted++;
    else run.changes.modified++;
  }
  figma.ui.postMessage({ type: 'changes', id: run.id, changes: { ...run.changes } });
}

function watchCurrentPage() {
  if (watchedPage) watchedPage.off('nodechange', onNodeChange);
  watchedPage = figma.currentPage;
  watchedPage.on('nodechange', onNodeChange);
}

function startRun(id) {
  const run = { id, start: Date.now(), end: undefined, changes: { created: 0, deleted: 0, modified: 0 } };
  runs.push(run);
  if (runs.length > 20) runs.shift();
  return run;
}

async function runCode(code) {
  try {
    return { result: await executeCode(code) };
  } catch (error) {
    return { error: error.message };
  }
}

// ---- Estado que ve el usuario ----
function sendFileInfo() {
  figma.ui.postMessage({ type: 'file', file: figma.root.name, page: figma.currentPage.name });
}

function sendSelection() {
  const sel = figma.currentPage.selection.map((n) => ({ id: n.id, name: n.name, type: n.type }));
  figma.ui.postMessage({ type: 'selection', selection: sel });
}

watchCurrentPage();
sendFileInfo();
sendSelection();

figma.on('selectionchange', sendSelection);
figma.on('currentpagechange', () => {
  watchCurrentPage();
  sendFileInfo();
  sendSelection();
});

const PAUSED_ERROR =
  'Pausado desde el plugin figma-steroids en Figma: el usuario detuvo la ejecución. ' +
  'Espera a que lo reanude antes de reintentar.';

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'eval') {
    if (paused) {
      figma.ui.postMessage({ type: 'result', id: msg.id, error: PAUSED_ERROR, log: { paused: true, ms: 0, changes: null } });
      return;
    }
    const run = startRun(msg.id);
    const out = await runCode(msg.code);
    run.end = Date.now();
    figma.ui.postMessage({
      type: 'result',
      id: msg.id,
      result: out.result,
      error: out.error,
      log: { ms: run.end - run.start, changes: { ...run.changes } },
    });
    sendFileInfo();
  }

  if (msg.type === 'eval-batch') {
    if (paused) {
      const results = msg.codes.map(() => ({ success: false, error: PAUSED_ERROR }));
      figma.ui.postMessage({ type: 'batch-result', id: msg.id, results, log: { paused: true, ms: 0, changes: null } });
      return;
    }
    const run = startRun(msg.id);
    const results = [];
    for (const code of msg.codes) {
      const out = await runCode(code);
      results.push(out.error ? { success: false, error: out.error } : { success: true, result: out.result });
    }
    run.end = Date.now();
    figma.ui.postMessage({ type: 'batch-result', id: msg.id, results, log: { ms: run.end - run.start, changes: { ...run.changes } } });
    sendFileInfo();
  }

  if (msg.type === 'set-paused') {
    paused = !!msg.paused;
    figma.notify(paused ? 'figma-steroids: IA en pausa' : 'figma-steroids: IA reanudada', { timeout: 1500 });
  }

  if (msg.type === 'resize') {
    figma.ui.resize(SIZES[msg.size].width, SIZES[msg.size].height);
  }

  if (msg.type === 'select-node') {
    const node = await figma.getNodeByIdAsync(msg.id);
    if (node && 'parent' in node) {
      figma.currentPage.selection = [node];
      figma.viewport.scrollAndZoomIntoView([node]);
    }
  }

  if (msg.type === 'notify') figma.notify(msg.text, { timeout: 1500 });

  if (msg.type === 'connected') {
    figma.notify('✓ figma-steroids conectado', { timeout: 2000 });
    sendFileInfo();
  }
  if (msg.type === 'disconnected') figma.notify('figma-steroids desconectado', { timeout: 2000 });
  if (msg.type === 'error') figma.notify('figma-steroids: ' + msg.message, { error: true });
};
