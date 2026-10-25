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
      if (!raw) continue;
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

  function authoredToken(el, props, prefix) {
    const styles = [el.style, ...rulesFor(el).reverse()];
    const re = new RegExp('var\\(\\s*' + prefix.replace(/-/g, '\\-') + '([a-zA-Z0-9-]+)');
    for (const st of styles) {
      for (const p of props) {
        const v = st && st.getPropertyValue(p);
        const m = v && v.match(re);
        if (m) return m[1];
      }
    }
    return null;
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
      // El color del texto puede venir heredado: se busca la variable en el elemento y sus padres.
      let token = null;
      for (let n = el; n && !token && n.nodeType === 1; n = n.parentElement || (n.getRootNode().host || null)) {
        token = authoredToken(n, ['color'], prefix);
      }
      const color = `color="${token ? 'var:' + token : colorAttr(cs.color, where)}"`;
      if (style) {
        report.textStyles[style.name] = (report.textStyles[style.name] || 0) + 1;
        return `textStyle="${esc(style.name)}" ${color}`;
      }
      report.rawText.push(`${where}: ${size}px/${weight}${lh ? '/' + lh : ''}`);
      return `size={${size}} weight="${WEIGHTS[Math.round(weight / 100) * 100] || 'regular'}"${lh ? ` lineHeight={${lh}}` : ''} ${color}`;
    }

    // ¿Ocupa todo el ancho disponible del padre? (w="fill")
    function fills(el, parent, pcs) {
      if (!parent) return false;
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
        return `${pad}<Text ${textAttrs(cs, t.slice(0, 24), parent)}>${escText(t)}</Text>`;
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

      // Texto puro (h1, p, span, dt…) → <Text>.
      if (onlyText && !bg && !st) {
        const t = el.textContent.replace(/\s+/g, ' ').trim();
        return `${pad}<Text ${textAttrs(cs, t.slice(0, 24), el)}${fill ? ' w="fill"' : ''}>${escText(t)}</Text>`;
      }

      // Elemento sin hijos: divisor, punto, rectángulo.
      if (!kids.length) {
        if (isCircle) return `${pad}<Ellipse w={${round(r.width)}} h={${round(r.height)}}${bg} />`;
        const w = fill ? 'w="fill"' : `w={${round(r.width)}}`;
        return `${pad}<Frame name="${esc(label)}" ${w} h={${round(r.height)}}${bg}${strokeAttr}${radius ? ` rounded={${round(radius)}}` : ''} />`;
      }

      // Contenedor → Frame con auto-layout.
      const isFlex = cs.display.includes('flex');
      let dir = isFlex ? cs.flexDirection : 'column';
      let children = kids;
      if (dir.endsWith('reverse')) { children = [...kids].reverse(); dir = dir.replace('-reverse', ''); }
      const row = dir === 'row';
      const gap = isFlex ? round(px(row ? cs.columnGap : cs.rowGap)) : 0;
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
      const fixedH = r.height - p[0] - p[2] - contentH > 1;
      const fixedW = r.width - p[1] - p[3] - contentW > 1;
      const w = depth === 0 ? `w={${round(r.width)}}`
        : fill ? 'w="fill"'
        : fixedW ? `w={${round(r.width)}}`
        : 'w="hug"';
      const h = fixedH ? ` h={${round(r.height)}}` : '';
      const name = depth === 0 && opts.name ? opts.name : label;

      const inner = children
        .map((k) => (k.nodeType === 3 ? walkText(k, el, depth + 1) : walk(k, el, depth + 1)))
        .filter(Boolean)
        .join('\n');
      return `${pad}<Frame name="${esc(name)}" flex="${row ? 'row' : 'col'}"${gap ? ` gap={${gap}}` : ''}${padAttr} ${w}${h}${justify ? ` justify="${justify}"` : ''} items="${items}"${bg}${strokeAttr}${radius ? ` rounded={${round(isCircle ? Math.min(r.width, r.height) / 2 : radius)}}` : ''}>\n${inner}\n${pad}</Frame>`;
    }

    function walkText(node, parent, depth) {
      const t = node.textContent.replace(/\s+/g, ' ').trim();
      if (!t) return '';
      return `${'  '.repeat(depth)}<Text ${textAttrs(getComputedStyle(parent), t.slice(0, 24), parent)}>${escText(t)}</Text>`;
    }

    const jsx = walk(root, root.parentElement, 0);
    probe.remove();
    return { jsx, report };
  };
})();
