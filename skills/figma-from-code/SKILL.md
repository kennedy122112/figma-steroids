---
name: figma-from-code
description: Reconstruye en Figma, como diseño editable, una pantalla o componente que ya existe en el código del proyecto (Angular, React, Lit, HTML/CSS/JS u otro), con auto-layout, las variables y estilos de texto del archivo y las instancias de sus componentes. Úsala cuando el usuario diga "pasa esta pantalla a Figma", "lleva este componente a Figma", "reconstruye la app en Figma", "documenta en Figma lo que ya está hecho", "code to design", "import this page into Figma".
---

# Código → Figma, en cualquier stack

Requisito: conexión activa (skill `figma-connect`). Es el camino contrario de `figma-to-code`.

La fuente de verdad es **la página renderizada en el navegador**, no solo el código: ahí están
las medidas reales, el layout ya resuelto y los estilos de todos los archivos combinados. El
código sirve para entender qué es cada cosa (componentes, props, tokens).

## 1. Localizar lo que hay que llevar
- Pregunta qué pantalla o componente, y en qué URL o ruta se ve (servidor de desarrollo,
  Storybook o un HTML estático). Si no está corriendo, levanta el servidor de desarrollo del
  proyecto y dile al usuario en qué puerto quedó (y apágalo al terminar).
- Lee el componente en el código y detecta el stack con la tabla de la skill `figma-to-code`.
  Anota qué componentes del proyecto usa (botón, input…) y si existen en Figma
  (`figma-cli find "<Nombre>"`): esos irán como **instancias**, no como copias.

## 2. Preparar el mapeo con el sistema de Figma
- **Variables:** `figma-cli var list`. El script relaciona las variables CSS del proyecto con las
  de Figma **por nombre**, quitando el prefijo (`--color-primary` → `var:primary`). Si los nombres
  no coinciden, no hay variables o el archivo tiene otro sistema, proponle al usuario importar
  primero los tokens del proyecto **en su propia colección**
  (`figma-cli import tokens.css --collection <Nombre>`) y renderiza fijando esa colección con
  `-c <Nombre>`: así `var:card` no se confunde con otra colección que tenga el mismo nombre.
  Revisa lo importado: con CSS compacto (varias reglas por línea) `import` crea variables basura
  como `ink);background`; bórralas antes de seguir.
- Con un prefijo genérico (`tokenPrefix: '--'`) el script solo toma las variables que son colores.
- **Estilos de texto** con su tamaño, peso e interlineado:
  ```
  figma-cli eval 'const s=await figma.getLocalTextStylesAsync(); s.map(t=>({name:t.name,size:t.fontSize,weight:({"Regular":400,"Medium":500,"Semi Bold":600,"Bold":700})[t.fontName.style],lineHeight:t.lineHeight.unit==="PIXELS"?t.lineHeight.value:null}))'
  ```

## 3. Leer la página con `scripts/dom-to-figma.js`
El script (en esta misma carpeta) recorre el DOM ya pintado, entra en el Shadow DOM y en los
`<slot>`, y devuelve `{ jsx, tree, report }`:
- flex → auto-layout (`flex`, `gap`, padding, `justify`, `items`), con `w="fill"`, fijo o "hug".
  Si varios hijos crecen con proporciones distintas (`flex: 1.5` / `flex: 1`), solo el más ancho
  queda "fill" (Figma reparte a partes iguales). Los márgenes del eje principal, también
  `margin: auto`, se convierten en espaciadores con la medida que calculó el navegador;
- tablas (`<table>`) → filas con celdas de su ancho real y las líneas de separación; CSS grid →
  fila con *wrap*;
- colores → `var:<token>` leyendo **la variable que usa el CSS** (`color: var(--color-…)`), y por
  valor solo si no la encuentra. Para el color del texto sube hasta el primer elemento que declara
  un color: un `color: #fff` cercano manda sobre el `var(--ink)` del body;
- textos → `textStyle` cuando tamaño, peso e interlineado coinciden (±1 px); si no, valores sueltos.
  Los que caben en una línea van con `w="hug"` (Figma mide la fuente un poco distinto y un ancho
  exacto los partiría);
- elementos que indiques en `components` → `<Instance>` del componente de Figma;
- iconos → `<Icon name="…">`, del color y tamaño reales:
  - SVG con nombre (`class="lucide-mail"`, `data-lucide`, `data-icon`) → `lucide:mail`;
  - **Material Symbols** (`<span class="material-symbols-outlined">calendar_month</span>`, también
    `-rounded`/`-sharp` y `FILL 1`) → `material-symbols:calendar-month-outline`;
  - **Material Icons y `<mat-icon>`** (texto o `fontIcon`) → `ic:baseline-settings`;
  - **SVG sin nombre** → con `domToFigmaAsync` se compara su **forma** con los ~2000 iconos de
    lucide y se usa el más parecido si supera el umbral (`minScore`, 0,65 por defecto); si no
    (un logo propio, un icono hecho a mano), se **copia el SVG del código** con sus colores reales
    (`out.svgs`) y se dibuja como vector editable en su sitio.
- `tree`: el mismo JSX partido en piezas de como mucho `maxNodes` nodos (60 por defecto). Un
  icono cuenta como 8 nodos, porque Figma tarda en dibujarlos.

Cómo ejecutarlo, según lo que tengas:
0. **Todo en un paso (recomendado si hay Node):** `scripts/from-url.mjs` abre la página con
   Playwright (Edge o Chrome ya instalados), lee el DOM, lee los estilos de texto de Figma,
   guarda el resultado y lo renderiza con `render-tree.mjs`:
   ```
   node scripts/from-url.mjs http://localhost:4200/dashboard --selector "main" --page "Desde código" -c <Colección> --prefix "--color-"
   ```
   También `figma-steroids from-url …`. Opciones: `--name`, `--width`/`--height` (1440×900),
   `--components components.json` (`[{ selector, component, variant }]`), `--out resultado.json` y
   `--dry-run` (solo lee y muestra el informe, sin tocar Figma: úsalo primero para revisarlo).
   Necesita `playwright-core` en el proyecto o global; si falta, pide permiso para instalarlo
   (`npm i -g playwright-core`). Al terminar, repasa el paso 4 con el informe.
1. **Herramienta de navegador del agente:** abre la página, inyecta el archivo (su contenido o un
   `fetch` a un servidor local) y llama a la función.
2. **Playwright**, si el proyecto lo tiene: `page.addScriptTag({ path })` y `page.evaluate(...)`.
3. **Sin navegador:** pídele al usuario que pegue el script en la consola de DevTools de la página,
   ejecute la llamada y te pase el resultado (`copy(JSON.stringify(out))` lo deja en el portapapeles).

```js
const out = domToFigma('article.profile-card', {   // selector o elemento (en Lit: el nodo del shadowRoot)
  tokenPrefix: '--color-',
  name: 'Profile Card',
  textStyles: [/* la lista del paso 2 */],
  components: [{ selector: '.profile-card .btn', component: 'Button',
                 variant: 'variant=primary, size=md, state=default' }],
});
```
Si la página tiene iconos de Material o SVG sin nombre, usa la versión asíncrona, que comprueba
los nombres en Iconify y compara las formas (necesita internet: `api.iconify.design` y
`cdn.jsdelivr.net`):
```js
const out = await domToFigmaAsync('main', { /* mismas opciones */ minScore: 0.65 });
```
Espera a `document.fonts.ready` (sin la fuente de Material, el icono es texto) y termina las transiciones antes de leer
(`el.getAnimations().forEach(a => a.finish())`).

Una pantalla completa da decenas de KB de JSX. No lo pases por el chat: guárdalo en un archivo
(`JSON.stringify(out)` con `{ jsx, tree, report }`) con un `fetch` POST a un servidor local mínimo,
con Playwright (`writeFileSync`) o con `copy()` en DevTools.

## 4. Revisar el informe antes de renderizar
- `unmappedColors`: colores sin variable → propón un token o confirma que son intencionales.
- `tiedTokens`: dos tokens con el mismo valor y sin variable escrita en el CSS → elige el semántico.
- `icons`: cada icono reconocido por forma con su parecido, las otras opciones y el texto que
  tiene cerca (`message-square (78 %) ← cerca de "Mensajes"`). Revisa los de parecido bajo: si la
  segunda opción encaja mejor con el texto, cámbiala en el JSX. Los "sin identificar" quedan como
  "Icono SVG · <texto cercano>", copiados del código: si en realidad son de la librería del
  proyecto (versión antigua de lucide, por ejemplo), propón cambiarlos por el `<Icon>` equivalente.
  Si el proyecto usa otra librería de iconos que el diseño, dilo (ver `figma-design-system`).
- `rawText`: textos sin estilo → si se repiten, propón un estilo nuevo.

## 5. Renderizar
1. **Pantallas grandes (más de ~60 nodos): `scripts/render-tree.mjs`.**
   ```
   node scripts/render-tree.mjs resultado.json --page "Desde código" -c <Colección>
   ```
   Renderiza el árbol pieza a pieza (cada contenedor grande primero vacío y luego sus hijos
   dentro) y por cada pieza: usa `--keep-wrapper` (sin él figma-cli separa una fila de tarjetas
   en piezas sueltas), quita el `w="fill"` de la raíz y lo restaura al moverla a su padre, compara
   la página antes y después para **borrar las copias** que dejan los reintentos de figma-cli, y
   repite la pieza hasta 3 veces si Figma tarda más de 90 s. Una pieza que es un solo texto o
   icono se renderiza dentro de un marco temporal que luego se borra. Al final dibuja los SVG
   copiados del código (`svgs`) en sus huecos. Un render de ~300 nodos de una vez
   desconecta el plugin y deja copias a medias.
   El plan gratuito de Figma solo permite 3 páginas por archivo: si `--page` no existe y no se
   puede crear, usa una página que ya exista.
2. **Pantallas pequeñas:** guarda el JSX en un archivo y renderiza **sin las `<Instance>`**:
   `figma-cli render -f card.jsx --page "Desde código"`. Con una instancia de un componente que
   vive en otra página, el render completo puede pasar de 90 s (Figma tiene que cargar esa
   página) y no dejar nada. Si el resultado trae `svgs`, dibújalos después en sus huecos:
   `node scripts/place-svgs.mjs resultado.json <id del frame raíz>`.
3. Añade cada instancia en su sitio con `--parent` (solo funciona con `<Instance>`; con un
   `<Frame>`, figma-cli 2.2.5 falla con "'frame' is not defined"):
   `figma-cli render --parent "<id del frame>" '<Instance component="Button" … />'`.
   Si debe ocupar el ancho, corrígelo después (`render` puede aplicar el `fill` al alto):
   `figma-cli eval 'const n=await figma.getNodeByIdAsync("<id>"); n.layoutSizingHorizontal="FILL"; n.layoutSizingVertical="FIXED"'`.
   Si el elemento del código tenía algo que el componente no admite (un icono), dilo.
4. Vincula radios y espaciado a las variables **por valor**; los valores fuera de la escala se listan:
   ```
   figma-cli eval 'const root=await figma.getNodeByIdAsync("<id>"); const vars=await figma.variables.getLocalVariablesAsync("FLOAT"); const val=(v)=>Object.values(v.valuesByMode)[0]; const radius=vars.filter(v=>/radius/i.test(v.name)); const spacing=vars.filter(v=>/^spacing\//.test(v.name)); const find=(list,n)=>list.find(v=>Math.abs(val(v)-n)<0.01); const bound={radius:0,gap:0,padding:0}, skipped=[]; const walk=(n)=>{ if(n.type==="INSTANCE") return; if("cornerRadius" in n && typeof n.cornerRadius==="number" && n.cornerRadius>0){ const v=find(radius,n.cornerRadius); if(v){ for (const k of ["topLeftRadius","topRightRadius","bottomLeftRadius","bottomRightRadius"]) n.setBoundVariable(k,v); bound.radius++ } else skipped.push(n.name+": radio "+n.cornerRadius) } if("layoutMode" in n && n.layoutMode!=="NONE"){ if(n.itemSpacing>0){ const v=find(spacing,n.itemSpacing); if(v){ n.setBoundVariable("itemSpacing",v); bound.gap++ } else skipped.push(n.name+": gap "+n.itemSpacing) } for (const k of ["paddingTop","paddingRight","paddingBottom","paddingLeft"]) if(n[k]>0){ const v=find(spacing,n[k]); if(v){ n.setBoundVariable(k,v); bound.padding++ } else skipped.push(n.name+": "+k+" "+n[k]) } } (n.children||[]).forEach(walk) }; walk(root); ({bound, skipped})'
   ```
   Un avatar circular (radio = mitad del lado) no se vincula al token del radio.

## 6. Comparar
- `figma-cli verify "<id>" --measure` y compara con las medidas del navegador
  (`getBoundingClientRect`). Diferencias de 1 px son normales: un estilo de texto del sistema
  puede tener un interlineado ligeramente distinto del código.
- Si existe el diseño original en Figma, compáralo también: es la mejor prueba de que la
  reconstrucción es fiel.

## Reglas
- No borres ni modifiques nada que ya existiera en el archivo; crea en una página o zona nueva.
- Usa las variables, estilos y componentes del archivo; no inventes otros sin preguntar.
- Si el usuario solo quiere una referencia visual (no un diseño editable), basta con
  `figma-cli screenshot-url "<url>"`. `figma-cli recreate-url` crea capas con posiciones absolutas
  y colores fijos, sin auto-layout ni variables: no sirve para un design system.

## Entrega
Dónde quedó (página e ID), qué componentes se usaron como instancias, qué se vinculó a variables
y estilos, y lo que no se pudo mapear (colores sin token, iconos, textos sin estilo, valores
fuera de la escala, partes que el componente no admite), con una propuesta para cada cosa.
