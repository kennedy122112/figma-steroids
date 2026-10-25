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
  primero los tokens del proyecto (skill `figma-design-system`).
- **Estilos de texto** con su tamaño, peso e interlineado:
  ```
  figma-cli eval 'const s=await figma.getLocalTextStylesAsync(); s.map(t=>({name:t.name,size:t.fontSize,weight:({"Regular":400,"Medium":500,"Semi Bold":600,"Bold":700})[t.fontName.style],lineHeight:t.lineHeight.unit==="PIXELS"?t.lineHeight.value:null}))'
  ```

## 3. Leer la página con `scripts/dom-to-figma.js`
El script (en esta misma carpeta) recorre el DOM ya pintado, entra en el Shadow DOM y en los
`<slot>`, y devuelve `{ jsx, report }`:
- flex → auto-layout (`flex`, `gap`, padding, `justify`, `items`), con `w="fill"`, fijo o "hug";
- colores → `var:<token>` leyendo **la variable que usa el CSS** (`color: var(--color-…)`), y por
  valor solo si no la encuentra;
- textos → `textStyle` cuando tamaño, peso e interlineado coinciden (±1 px); si no, valores sueltos;
- elementos que indiques en `components` → `<Instance>` del componente de Figma;
- iconos SVG → `<Icon name="lucide:…">` si llevan nombre (`class="lucide-mail"`, `data-icon`).

Cómo ejecutarlo, según lo que tengas:
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
Espera a `document.fonts.ready` y termina las transiciones antes de leer
(`el.getAnimations().forEach(a => a.finish())`).

## 4. Revisar el informe antes de renderizar
- `unmappedColors`: colores sin variable → propón un token o confirma que son intencionales.
- `tiedTokens`: dos tokens con el mismo valor y sin variable escrita en el CSS → elige el semántico.
- `icons`: iconos sin nombre → elige el equivalente de lucide mirando el código.
- `rawText`: textos sin estilo → si se repiten, propón un estilo nuevo.

## 5. Renderizar
1. Guarda el JSX en un archivo y renderiza **sin las `<Instance>`**, en la página que pida el
   usuario: `figma-cli render -f card.jsx --page "Desde código"`.
   Con una instancia de un componente que vive en otra página, el render completo puede pasar de
   90 s (Figma tiene que cargar esa página) y no dejar nada.
2. Añade cada instancia en su sitio con `--parent`:
   `figma-cli render --parent "<id del frame>" '<Instance component="Button" … />'`.
   Si debe ocupar el ancho, corrígelo después (`render` puede aplicar el `fill` al alto):
   `figma-cli eval 'const n=await figma.getNodeByIdAsync("<id>"); n.layoutSizingHorizontal="FILL"; n.layoutSizingVertical="FIXED"'`.
   Si el elemento del código tenía algo que el componente no admite (un icono), dilo.
3. Vincula radios y espaciado a las variables **por valor**; los valores fuera de la escala se listan:
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
