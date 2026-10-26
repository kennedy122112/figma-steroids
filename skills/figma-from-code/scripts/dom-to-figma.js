/**
 * dom-to-figma: convierte un componente ya renderizado en el navegador en JSX de figma-cli
 * (`figma-cli render`), con auto-layout, variables (var:) y estilos de texto.
 *
 * Se ejecuta EN LA PÁGINA (herramienta de navegador del agente, Playwright o la consola de
 * DevTools). Define window.domToFigma y devuelve { jsx, report }.
 *
 *   domToFigma('article.profile-card', {
 *     tokenPrefix: '--color-',              // prefijo de las variables CSS de color
 *     textStyles: [{ name: 'Text/Body', size: 14, weight: 400, lineHeight: 20 }, …],
 *     components: [{ selector: 'button', component: 'Button',
 *                    variant: 'variant=primary, size=md, state=default' }],
 *     name: 'Profile Card (desde código)',
 *   })
 *
 * Lee el DOM "compuesto": entra en shadowRoot y sigue los <slot>, así funciona igual con
 * React, Angular, Lit, Web Components o HTML sin framework.
 */
(function () {
  const WEIGHTS = { 100: 'thin', 200: 'extralight', 300: 'light', 400: 'regular', 500: 'medium', 600: 'semibold', 700: 'bold', 800: 'extrabold', 900: 'black' };

  const round = (n) => Math.round(n * 100) / 100;
  const px = (v) => parseFloat(v) || 0;
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const escText = (s) => String(s).replace(/[{}<>]/g, (c) => ({ '{': '&#123;', '}': '&#125;', '<': '&lt;', '>': '&gt;' }[c]));

  // Normaliza cualquier color CSS a "rgb(r, g, b)" / "rgba(...)" usando el propio navegador.
  // El elemento de prueba se crea en cada llamada y se quita al terminar.
  let probe = null;
  function norm(color) {
    probe.style.color = '';
    probe.style.color = color;
    return getComputedStyle(probe).color;
  }
  const toHex = (rgb) => {
    const m = rgb.match(/\d+(\.\d+)?/g);
    if (!m) return null;
    return '#' + m.slice(0, 3).map((x) => Math.round(+x).toString(16).padStart(2, '0')).join('');
  };
  const transparent = (c) => !c || c === 'transparent' || /rgba\(.*,\s*0\)$/.test(c);

  // Variables CSS de color declaradas en las hojas de estilo (incluye @theme de Tailwind v4).
  function collectTokens(prefix) {
    const names = new Set();
    const scan = (sheet) => {
      let text = '';
      try { text = [...sheet.cssRules].map((r) => r.cssText).join('\n'); } catch (e) { return; }
      for (const m of text.matchAll(new RegExp(prefix.replace(/[-]/g, '\\-') + '[a-zA-Z0-9-]+', 'g'))) names.add(m[0]);
    };
    [...document.styleSheets].forEach(scan);
    // Hojas adoptadas por Web Components (Lit) también pueden declarar tokens.
    document.querySelectorAll('*').forEach((el) => el.shadowRoot && (el.shadowRoot.adoptedStyleSheets || []).forEach(scan));
    const root = getComputedStyle(document.documentElement);
    const byColor = new Map();
    for (const name of names) {
      const raw = root.getPropertyValue(name).trim();
      // Con un prefijo genérico ("--") también aparecen medidas o fuentes: solo cuentan colores.
      if (!raw || !CSS.supports('color', raw)) continue;
      const rgb = norm(raw);
      // Si dos tokens comparten valor (card y background en blanco), gana el primero declarado:
      // el informe lista los empates para que el agente decida.
      const token = name.slice(prefix.length);
      if (!byColor.has(rgb)) byColor.set(rgb, [token]);
      else byColor.get(rgb).push(token);
    }
    return byColor;
  }

  // Hijos "compuestos": lo que realmente se pinta (shadow DOM y contenido de los <slot>).
  function composedChildren(el) {
    const kids = el.shadowRoot ? [...el.shadowRoot.childNodes] : [...el.childNodes];
    const out = [];
    for (const k of kids) {
      if (k.nodeType === 1 && k.tagName === 'SLOT') out.push(...k.assignedNodes({ flatten: true }));
      else if (k.nodeType === 1 && k.tagName === 'STYLE') continue;
      else out.push(k);
    }
    return out;
  }

  const visible = (el) => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return cs.display !== 'none' && cs.visibility !== 'hidden' && (r.width > 0 || r.height > 0);
  };

  // Variable que el CSS usa de verdad para una propiedad ("color: var(--color-primary-foreground)").
  // Distingue tokens con el mismo valor (card y primary-foreground en blanco). Recorre las hojas
  // del documento y las del shadow root del elemento, incluidas @layer y @media anidadas.
  function rulesFor(el) {
    const root = el.getRootNode();
    const sheets = [...(root.styleSheets || []), ...(root.adoptedStyleSheets || [])];
    if (root !== document) sheets.push(...document.styleSheets);
    const out = [];
    const visit = (rules) => {
      for (const rule of rules) {
        if (rule.cssRules && !rule.selectorText) { visit(rule.cssRules); continue; }
        if (!rule.selectorText || !rule.style) continue;
        let match = false;
        try { match = el.matches(rule.selectorText.replace(/::?(before|after|placeholder)\b/g, '')); } catch (e) {}
        if (match) out.push(rule.style);
      }
    };
    for (const s of sheets) { try { visit(s.cssRules); } catch (e) {} }
    return out;
  }

  // Primer valor declarado para alguna de las propiedades (estilo en línea, luego reglas).
  function declared(el, props) {
    const styles = [el.style, ...rulesFor(el).reverse()];
    for (const st of styles) {
      for (const p of props) {
        const v = st && st.getPropertyValue(p);
        if (v && v.trim()) return v.trim();
      }
    }
    return null;
  }

  function authoredToken(el, props, prefix) {
    const v = declared(el, props);
    const m = v && v.match(new RegExp('var\\(\\s*' + prefix.replace(/-/g, '\\-') + '([a-zA-Z0-9-]+)'));
    return m ? m[1] : null;
  }

  const UTILITY = /^(flex|grid|inline|block|contents|hidden|relative|absolute|h-|w-|p[xytrbl]?-|m[xytrbl]?-|gap|bg-|text-|font-|leading-|rounded|ring|border|items|justify|size-|min-|max-|shrink|grow|overflow|transition|focus|hover|disabled|sr-only)/;
  const TAGS = { header: 'Header', footer: 'Footer', nav: 'Nav', section: 'Section', article: 'Card', aside: 'Aside', hr: 'Divider', button: 'Button', a: 'Link', dl: 'List', ul: 'List', ol: 'List', li: 'Item', img: 'Image', input: 'Input', form: 'Form', label: 'Label' };
  function layerName(el) {
    if (el.getAttribute('aria-label')) return el.getAttribute('aria-label');
    if (el.dataset && el.dataset.name) return el.dataset.name;
    const cls = (el.getAttribute('class') || '').split(/\s+/).filter(Boolean);
    const meaningful = cls.find((c) => !UTILITY.test(c));
    if (meaningful) return meaningful;
    const tag = el.tagName.toLowerCase();
    return tag.includes('-') ? tag : TAGS[tag] || tag;
  }

  // Elemento que solo contiene texto, sin fondo ni borde, y que cabe en una línea.
  function singleLineText(el) {
    if (el.nodeType !== 1) return false;
    const kids = [...el.childNodes].filter((k) => k.nodeType === 1 || k.textContent.trim());
    if (!kids.length || !kids.every((k) => k.nodeType === 3)) return false;
    const cs = getComputedStyle(el);
    const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
    return el.getBoundingClientRect().height <= lh * 1.5;
  }

  // Nodo de texto suelto que cabe en una línea → w="hug" (ver el comentario en walk).
  function hugIfOneLine(textNode, cs) {
    const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
    return rectOf(textNode).height <= lh * 1.5 ? ' w="hug"' : '';
  }

  // Rectángulo de un hijo, sea elemento o nodo de texto.
  function rectOf(node) {
    if (node.nodeType === 1) return node.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(node);
    return range.getBoundingClientRect();
  }

  window.domToFigma = function domToFigma(target, opts = {}) {
    probe = document.createElement('span');
    probe.style.display = 'none';
    document.body.appendChild(probe);
    const prefix = opts.tokenPrefix || '--color-';
    const tokens = collectTokens(prefix);
    const report = { tokenColors: tokens.size, unmappedColors: {}, tiedTokens: {}, icons: [], textStyles: {}, rawText: [], components: [] };
    const root = typeof target === 'string' ? document.querySelector(target) : target;
    if (!root) throw new Error('No encuentro el elemento ' + target);

    // el y props permiten leer la variable escrita en el CSS antes de comparar por valor.
    const colorAttr = (c, where, el, props) => {
      const authored = el && props && authoredToken(el, props, prefix);
      if (authored) return 'var:' + authored;
      const rgb = norm(c);
      const hit = tokens.get(rgb);
      if (hit) {
        if (hit.length > 1) report.tiedTokens[rgb] = hit;
        return 'var:' + hit[0];
      }
      const hex = toHex(rgb);
      report.unmappedColors[hex] = (report.unmappedColors[hex] || []).concat(where).slice(0, 5);
      return hex;
    };

    function textAttrs(cs, where, el) {
      const size = round(px(cs.fontSize));
      const weight = parseInt(cs.fontWeight, 10) || 400;
      const lh = cs.lineHeight === 'normal' ? null : round(px(cs.lineHeight));
      const style = (opts.textStyles || []).find((s) => s.size === size && s.weight === weight && (!s.lineHeight || !lh || Math.abs(s.lineHeight - lh) <= 1));
      // El color del texto puede venir heredado: se sube hasta el primer elemento que DECLARA un
      // color. Si es una variable, se usa; si es un color fijo (#fff), se compara por valor. No
      // seguir subiendo: el body (var(--ink)) no manda sobre un `color: #fff` más cercano.
      let token = null;
      for (let n = el; n && n.nodeType === 1; n = n.parentElement || (n.getRootNode().host || null)) {
        const v = declared(n, ['color']);
        if (!v || v === 'inherit') continue;
        const m = v.match(new RegExp('var\\(\\s*' + prefix.replace(/-/g, '\\-') + '([a-zA-Z0-9-]+)'));
        token = m ? m[1] : null;
        break;
      }
      const color = `color="${token ? 'var:' + token : colorAttr(cs.color, where)}"`;
      if (style) {
        report.textStyles[style.name] = (report.textStyles[style.name] || 0) + 1;
        return `textStyle="${esc(style.name)}" ${color}`;
      }
      report.rawText.push(`${where}: ${size}px/${weight}${lh ? '/' + lh : ''}`);
      return `size={${size}} weight="${WEIGHTS[Math.round(weight / 100) * 100] || 'regular'}"${lh ? ` lineHeight={${lh}}` : ''} ${color}`;
    }

    // Hijos que deben llevar su ancho real aunque en CSS crezcan (ver "proporciones" más abajo).
    const fixedWidth = new WeakSet();

    // ¿Ocupa todo el ancho disponible del padre? (w="fill")
    function fills(el, parent, pcs) {
      if (!parent || fixedWidth.has(el)) return false;
      // En rejillas y tablas cada celda conserva su ancho real (no hay "fill" con wrap).
      if (pcs.display.includes('grid') || pcs.display.startsWith('table')) return false;
      const cs = getComputedStyle(el);
      const dir = pcs.flexDirection || 'row';
      const isFlex = pcs.display.includes('flex');
      if (isFlex && dir.startsWith('row')) return px(cs.flexGrow) > 0;
      const pr = parent.getBoundingClientRect();
      const inner = pr.width - px(pcs.paddingLeft) - px(pcs.paddingRight) - px(pcs.borderLeftWidth) - px(pcs.borderRightWidth);
      return Math.abs(el.getBoundingClientRect().width - inner) < 1;
    }

    function stroke(cs) {
      const m = cs.boxShadow && cs.boxShadow.match(/(rgba?\([^)]*\)|#[0-9a-f]+)\s+0px\s+0px\s+0px\s+(\d+(\.\d+)?)px\s+inset|inset\s+0px\s+0px\s+0px\s+(\d+(\.\d+)?)px\s+(rgba?\([^)]*\))/i);
      if (m) return { color: m[1] || m[6], width: px(m[2] || m[4]) };
      const bw = px(cs.borderTopWidth);
      if (bw > 0 && cs.borderTopStyle !== 'none' && !transparent(cs.borderTopColor)) return { color: cs.borderTopColor, width: bw };
      return null;
    }

    function iconFor(svg) {
      const cls = svg.getAttribute('class') || '';
      const lucide = cls.match(/lucide-([a-z0-9-]+)/);
      const named = svg.getAttribute('data-icon') || svg.getAttribute('data-lucide') || (lucide && lucide[1]);
      return named ? `lucide:${named.replace(/^lucide:/, '')}` : null;
    }

    function walk(el, parent, depth) {
      const pad = '  '.repeat(depth);
      if (el.nodeType === 3) {
        const t = el.textContent.replace(/\s+/g, ' ').trim();
        if (!t) return '';
        const cs = getComputedStyle(parent);
        return `${pad}<Text ${textAttrs(cs, t.slice(0, 24), parent)}${hugIfOneLine(el, cs)}>${escText(t)}</Text>`;
      }
      if (el.nodeType !== 1 || !visible(el)) return '';
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const pcs = parent ? getComputedStyle(parent) : null;
      const label = layerName(el).slice(0, 40);

      // Componentes del proyecto → instancias del componente de Figma.
      const comp = (opts.components || []).find((c) => el.matches && el.matches(c.selector));
      if (comp) {
        const text = el.innerText ? el.innerText.replace(/\s+/g, ' ').trim() : '';
        report.components.push(`${comp.component} ← ${label}`);
        const w = fills(el, parent, pcs) ? ' w="fill"' : '';
        return `${pad}<Instance component="${esc(comp.component)}"${comp.variant ? ` variant="${esc(comp.variant)}"` : ''}${text ? ` text="${esc(text)}"` : ''}${w} />`;
      }

      if (el.tagName === 'svg' || el.tagName === 'SVG') {
        const name = iconFor(el);
        const size = round(Math.max(r.width, r.height));
        const color = colorAttr(cs.color, 'icono', el, ['color', 'stroke']);
        if (name) return `${pad}<Icon name="${name}" size={${size}} color="${color}" />`;
        report.icons.push(`${round(r.width)}×${round(r.height)} sin nombre (cerca de "${label}")`);
        return `${pad}<Frame name="Icono (elige uno de lucide)" w={${round(r.width)}} h={${round(r.height)}} />`;
      }

      const kids = composedChildren(el).filter((k) => (k.nodeType === 3 && k.textContent.trim()) || (k.nodeType === 1 && visible(k)));
      const onlyText = kids.length > 0 && kids.every((k) => k.nodeType === 3);
      const bg = transparent(cs.backgroundColor) ? '' : ` bg="${colorAttr(cs.backgroundColor, label, el, ['background-color', 'background'])}"`;
      const radius = px(cs.borderTopLeftRadius);
      const isCircle = radius >= Math.min(r.width, r.height) / 2 - 0.5 && Math.abs(r.width - r.height) < 1;
      const st = stroke(cs);
      const strokeAttr = st ? ` stroke="${colorAttr(st.color, label + ' (borde)', el, ['box-shadow', '--tw-ring-color', 'border-color', 'border', 'outline-color'])}" strokeWidth={${st.width}}` : '';
      const fill = fills(el, parent, pcs);

      // Texto puro (h1, p, span, dt…) → <Text>. Si en el navegador cabe en una línea, no se le
      // fija ancho: Figma mide la fuente un poco distinto y un ancho exacto lo partiría en dos.
      if (onlyText && !bg && !st && !cs.display.startsWith('table')) {
        const t = el.textContent.replace(/\s+/g, ' ').trim();
        // figma-cli pone "fill" por defecto a los textos dentro de una columna: hay que pedir
        // "hug" explícitamente o el texto se ajusta al ancho medido en el navegador y se parte.
        const sizing = singleLineText(el) ? ' w="hug"' : fill ? ' w="fill"' : '';
        return `${pad}<Text ${textAttrs(cs, t.slice(0, 24), el)}${sizing}>${escText(t)}</Text>`;
      }

      // Tablas: thead/tbody no generan capa; cada fila es un Frame en fila y cada celda conserva
      // su ancho. Un borde inferior en las celdas se convierte en una línea bajo la fila.
      if (cs.display === 'table-header-group' || cs.display === 'table-row-group' || cs.display === 'table-footer-group') {
        return kids.filter((k) => k.nodeType === 1).map((k) => walk(k, el, depth)).filter(Boolean).join('\n');
      }
      if (cs.display === 'table-row') {
        const cells = kids.filter((k) => k.nodeType === 1);
        const inner = cells.map((c) => walk(c, el, depth + 1)).filter(Boolean).join('\n');
        const first = cells[0] && getComputedStyle(cells[0]);
        const line = first && px(first.borderBottomWidth) > 0 && !transparent(first.borderBottomColor)
          ? `\n${pad}<Frame name="Separador" w="fill" h={${px(first.borderBottomWidth)}} bg="${colorAttr(first.borderBottomColor, 'separador de tabla', cells[0], ['border-bottom-color', 'border-bottom', 'border-color', 'border'])}" />`
          : '';
        return `${pad}<Frame name="Fila" flex="row" w="fill" items="center"${bg}>\n${inner}\n${pad}</Frame>${line}`;
      }
      if (cs.display === 'table-cell') {
        const p = [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft].map(px);
        // vertical-align por defecto (baseline) se ve centrado en una fila: se trata como center.
        const items = { top: 'start', bottom: 'end' }[cs.verticalAlign] || 'center';
        const align = { center: 'center', right: 'end', end: 'end' }[cs.textAlign];
        const inner = kids.map((k) => (k.nodeType === 3 ? walkText(k, el, depth + 1) : walk(k, el, depth + 1))).filter(Boolean).join('\n');
        return `${pad}<Frame name="${el.tagName === 'TH' ? 'Encabezado' : 'Celda'}" flex="row" pt={${p[0]}} pr={${p[1]}} pb={${p[2]}} pl={${p[3]}} w={${round(r.width)}} items="${items}"${align ? ` justify="${align}"` : ''}${bg}>\n${inner}\n${pad}</Frame>`;
      }

      // Elemento sin hijos: divisor, punto, rectángulo.
      if (!kids.length) {
        if (isCircle) return `${pad}<Ellipse w={${round(r.width)}} h={${round(r.height)}}${bg} />`;
        const w = fill ? 'w="fill"' : `w={${round(r.width)}}`;
        return `${pad}<Frame name="${esc(label)}" ${w} h={${round(r.height)}}${bg}${strokeAttr}${radius ? ` rounded={${round(radius)}}` : ''} />`;
      }

      // Contenedor → Frame con auto-layout. Una rejilla (CSS grid) con varias columnas se
      // aproxima con una fila que salta de línea (wrap); un <table> es una columna de filas.
      const isGrid = cs.display.includes('grid') && cs.gridTemplateColumns.trim().split(/\s+/).length > 1;
      const isFlex = cs.display.includes('flex') || isGrid;
      let dir = isGrid ? 'row' : isFlex ? cs.flexDirection : 'column';
      let children = kids;
      if (dir.endsWith('reverse')) { children = [...kids].reverse(); dir = dir.replace('-reverse', ''); }
      const row = dir === 'row';
      const gap = isFlex ? round(px(row ? cs.columnGap : cs.rowGap)) : 0;

      // Proporciones: Figma reparte "fill" a partes iguales, CSS no (flex: 1.5 / flex: 1). Si
      // varios hijos crecen en una fila con anchos distintos, solo el más ancho queda "fill" y
      // el resto conserva su ancho real.
      if (row && isFlex && !isGrid) {
        const growing = children.filter((k) => k.nodeType === 1 && px(getComputedStyle(k).flexGrow) > 0);
        const widths = growing.map((k) => k.getBoundingClientRect().width);
        if (growing.length > 1 && Math.max(...widths) - Math.min(...widths) > 1) {
          const widest = growing[widths.indexOf(Math.max(...widths))];
          growing.forEach((k) => k !== widest && fixedWidth.add(k));
        }
      }
      const p = [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft].map(px);
      const padAttr = p.every((v) => v === p[0]) ? (p[0] ? ` p={${p[0]}}` : '') : ` pt={${p[0]}} pr={${p[1]}} pb={${p[2]}} pl={${p[3]}}`;
      const justify = { center: 'center', 'space-between': 'between', 'flex-end': 'end', end: 'end' }[cs.justifyContent];
      const items = { center: 'center', 'flex-end': 'end', end: 'end', baseline: 'end', 'flex-start': 'start', start: 'start' }[cs.alignItems] || 'start';

      // ¿Tamaño fijo? Si el contenido no llena la caja (avatar, botón), se fija; si no, "hug".
      const kidRects = children.map(rectOf);
      const sum = (a) => a.reduce((s, v) => s + v, 0);
      const contentH = kidRects.length
        ? (row ? Math.max(...kidRects.map((k) => k.height)) : sum(kidRects.map((k) => k.height)) + gap * (kidRects.length - 1))
        : 0;
      const contentW = kidRects.length
        ? (row ? sum(kidRects.map((k) => k.width)) + gap * (kidRects.length - 1) : Math.max(...kidRects.map((k) => k.width)))
        : 0;
      // La raíz conserva el tamaño exacto de la pantalla (p. ej. 1440×960 con overflow oculto).
      const fixedH = depth === 0 || r.height - p[0] - p[2] - contentH > 1;
      // En Figma un hijo "fill" no puede estar dentro de un padre "hug": si alguno llena, el
      // ancho del padre se fija (con --parent, figma-cli falla en ese caso).
      const childFills = children.some((k) => k.nodeType === 1 && !singleLineText(k) && fills(k, el, cs));
      const fixedW = r.width - p[1] - p[3] - contentW > 1 || childFills;
      const w = depth === 0 || fixedWidth.has(el) ? `w={${round(r.width)}}`
        : fill ? 'w="fill"'
        : fixedW ? `w={${round(r.width)}}`
        : 'w="hug"';
      const h = fixedH ? ` h={${round(r.height)}}` : '';
      const name = depth === 0 && opts.name ? opts.name : label;

      // Márgenes en el eje principal (incluido margin: auto, que el navegador ya resolvió en px)
      // → espaciadores. El gap también separa al espaciador, así que se descuenta una vez.
      const spacer = (m, k) => {
        const size = round(m - gap);
        if (size <= 0.5) return '';
        return row
          ? `${'  '.repeat(depth + 1)}<Frame name="Espacio" w={${size}} h={1} />`
          : `${'  '.repeat(depth + 1)}<Frame name="Espacio" w={1} h={${size}} />`;
      };
      const inner = children
        .map((k) => {
          if (k.nodeType === 3) return walkText(k, el, depth + 1);
          const out = walk(k, el, depth + 1);
          if (!out || !isFlex || isGrid) return out;
          const kcs = getComputedStyle(k);
          const before = px(row ? kcs.marginLeft : kcs.marginTop);
          const after = px(row ? kcs.marginRight : kcs.marginBottom);
          // Sin espaciador la distancia sería solo el gap; con él es gap + espaciador + gap.
          // Para que sea gap + margen, el espaciador mide margen − gap.
          return [before > 0 ? spacer(before, k) : '', out, after > 0 ? spacer(after, k) : ''].filter(Boolean).join('\n');
        })
        .filter(Boolean)
        .join('\n');
      return `${pad}<Frame name="${esc(name)}" flex="${row ? 'row' : 'col'}"${isGrid ? ' wrap={true}' : ''}${gap ? ` gap={${gap}}` : ''}${padAttr} ${w}${h}${justify ? ` justify="${justify}"` : ''} items="${items}"${bg}${strokeAttr}${radius ? ` rounded={${round(isCircle ? Math.min(r.width, r.height) / 2 : radius)}}` : ''}>\n${inner}\n${pad}</Frame>`;
    }

    function walkText(node, parent, depth) {
      const t = node.textContent.replace(/\s+/g, ' ').trim();
      if (!t) return '';
      const pcs = getComputedStyle(parent);
      return `${'  '.repeat(depth)}<Text ${textAttrs(pcs, t.slice(0, 24), parent)}${hugIfOneLine(node, pcs)}>${escText(t)}</Text>`;
    }

    const jsx = walk(root, root.parentElement, 0);
    probe.remove();
    const tree = splitJsx(jsx, opts.maxNodes || 60);
    report.nodes = tree.count;
    return { jsx, tree, report };
  };

  // Parte el JSX en un árbol de piezas renderizables por separado: un contenedor con más de
  // maxNodes nodos se convierte en su "cascarón" (el Frame vacío) más sus hijos, y así hacia
  // abajo. Un render enorme deja a Figma ocupado más de 90 s: el plugin se desconecta y
  // figma-cli reintenta y duplica. Se apoya en el formato de walk (un elemento por línea).
  function splitJsx(jsx, maxNodes) {
    const lines = jsx.split('\n');
    const indent = (l) => l.match(/^ */)[0].length;
    const isOpen = (l) => /^\s*<Frame\b/.test(l) && !/\/>\s*$/.test(l);
    function parse(i) {
      const line = lines[i];
      if (!isOpen(line)) return { node: { jsx: line.trim(), count: 1, children: [] }, next: i + 1 };
      const ind = indent(line);
      const kids = [];
      let j = i + 1;
      while (j < lines.length && !(indent(lines[j]) === ind && lines[j].trim() === '</Frame>')) {
        const r = parse(j);
        kids.push(r.node);
        j = r.next;
      }
      const count = 1 + kids.reduce((s, k) => s + k.count, 0);
      const open = line.trim();
      const full = [line, ...lines.slice(i + 1, j + 1)].map((l) => l.slice(ind)).join('\n');
      if (count <= maxNodes) return { node: { jsx: full, count, children: [] }, next: j + 1 };
      return { node: { jsx: open + '</Frame>', count, shell: true, children: kids }, next: j + 1 };
    }
    return parse(0).node;
  }
  window.splitJsx = splitJsx;
})();
