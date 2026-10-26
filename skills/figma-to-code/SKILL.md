---
name: figma-to-code
description: Implementa un frame o componente de Figma como código en el stack del proyecto (Angular, React, Lit, HTML/CSS/JS u otro), reutilizando sus componentes y tokens, y comprueba que el resultado coincide con el diseño. Úsala cuando el usuario diga "implementa este diseño", "pásalo a código", "convierte este frame en un componente", "maqueta esta pantalla", "design to code", "build this Figma frame".
---

# Figma → código, en cualquier stack

Requisito: conexión activa (skill `figma-connect`). El usuario selecciona el frame en
Figma o te da su nombre o ID.

## 1. Detectar el stack
Mira la raíz del proyecto y carga **solo** el adaptador que corresponda, de `stacks/`:

| Señal en el proyecto | Adaptador |
|---|---|
| `angular.json` o `@angular/core` en `package.json` | `stacks/angular.md` |
| `react` en `package.json` (Vite, Next, CRA…) | `stacks/react.md` |
| `lit` en `package.json` | `stacks/lit.md` |
| HTML, CSS y JavaScript sin framework (sin `package.json`, o sin framework en él) | `stacks/html.md` |
| Ninguno de los anteriores | `stacks/generic.md` |

Detecta además: TypeScript o JavaScript (`tsconfig.json`), sistema de estilos
(Tailwind, SCSS, CSS Modules…) y librería de componentes propia o de terceros.
Si un monorepo tiene varios stacks, pregunta en cuál implementar.

## 2. Leer el diseño (independiente del stack)
Parte de la **estructura**, no de código generado:
- `figma-cli select "<id>"` y luego `figma-cli extract --selection .figma/selection.md`: layout,
  medidas y la lista de tokens del frame. Es material de trabajo: no lo subas al repositorio
  (añade `.figma/` al `.gitignore` del proyecto si no está).
- El extract **no dice qué variable usa cada nodo**. Sácalo con este `eval` de solo lectura
  (colores vinculados, tipografía y radios por nodo):
  ```
  figma-cli eval 'const n=await figma.getNodeByIdAsync("<id>"); const vars={}; for (const v of await figma.variables.getLocalVariablesAsync()) vars[v.id]=v.name; const out=[]; const w=async(x,d)=>{ const b=x.boundVariables||{}; const r={d,name:x.name.slice(0,30),type:x.type,w:Math.round(x.width),h:Math.round(x.height)}; if(b.fills&&b.fills[0]) r.fill=vars[b.fills[0].id]; if(b.strokes&&b.strokes[0]) r.stroke=vars[b.strokes[0].id]; if(x.type==="TEXT"){ r.font=x.fontName.family; r.size=x.fontSize; r.weight=x.fontName.style; r.lh=x.lineHeight.unit==="AUTO"?"auto":x.lineHeight.value } if(x.cornerRadius) r.radius=x.cornerRadius; out.push(r); for (const c of (x.children||[])) await w(c,d+1) }; await w(n,0); out'
  ```
- `figma-cli get "<id>"` y `figma-cli inspect "<id>" --json`: propiedades exactas de un nodo.
- `figma-cli verify "<id>" --measure`: captura de referencia con las medidas reales.
- Si es un componente con variantes: `figma-cli spec <Nombre>` (ejes y tamaños).

`figma-cli export-jsx` genera **solo React**. No lo traduzcas a otros stacks; en
React úsalo solo como referencia de estructura, nunca como código final.

## 3. Mapear tokens
1. Busca dónde viven los tokens en el proyecto (`tailwind.config.*`, `@theme`, `:root` en CSS, `tokens.json`…).
2. Relaciona cada variable de Figma usada en el frame con su token en el código, por nombre.
3. Si falta alguno, **no pegues el hex**: propón añadirlo al sistema de tokens
   (`figma-cli export dtcg` o `figma-cli export css` dan los valores) y pide confirmación.
4. Revisa también la **tipografía**: si el diseño usa una fuente (por ejemplo Inter) que el
   proyecto no define ni carga, el texto saldrá más ancho o más estrecho y nada cuadrará.
   Propón definirla como token (`--font-sans` en Tailwind v4) y cargarla con **todos los
   pesos que usa el diseño** (por ejemplo 400, 500, 600 y 700): si falta uno, el navegador lo
   simula y el texto no cuadrará.
5. **Tema oscuro:** si el archivo tiene modos `Light`/`Dark` o una colección `… · Dark`, genera
   los bloques `:root` y `.dark` con el `eval` de la skill `figma-design-system` (no con
   `export css`, que mezcla los temas). En Tailwind v4 los tokens del `@theme` son variables
   CSS: basta con redefinirlos en `.dark { --color-…: … }` y declarar
   `@custom-variant dark (&:where(.dark, .dark *));`. Si el componente usa solo tokens, cambia de
   tema sin tocar su código; un color fijo en una clase (`bg-white`, `text-[#…]`) no cambiará,
   así que búscalos al verificar con la clase `dark` puesta.
6. **Iconos:** usa la librería de iconos **del proyecto**, no la del diseño si difieren (y
   avísalo). El nombre de Figma (`<colección>:<nombre>` en el nombre de la capa) se traduce así:
   - `lucide:calendar-days` → `<CalendarDays />` de `lucide-react`,
     `<lucide-icon name="calendar-days">` de `lucide-angular`, o el SVG de lucide en HTML/Lit.
   - `material-symbols:calendar-month-outline` → `<span class="material-symbols-outlined">calendar_month</span>`
     (guiones a `_`; `-rounded`/`-sharp` → `material-symbols-rounded`/`-sharp`; sin `-outline`,
     relleno: `font-variation-settings: 'FILL' 1`). En Angular Material: `<mat-icon fontSet="material-symbols-outlined">calendar_month</mat-icon>`.
   - `ic:baseline-settings` → `<mat-icon>settings</mat-icon>` o `<span class="material-icons">settings</span>`.
   Si el proyecto no tiene la librería instalada, propón instalarla antes de añadirla.

## 4. Reutilizar antes de crear
Busca en el proyecto componentes equivalentes (botones, inputs, cards…) y úsalos.
Solo crea un componente nuevo si no existe ninguno, y sigue las convenciones del
adaptador y del propio proyecto (nombres, carpetas, estilo de imports).

Si un componente existente casi encaja (por ejemplo, el diseño pide un botón de 14 px y el
del proyecto solo tiene 15), **extiéndelo de forma compatible**: una prop o input nueva con
el valor actual por defecto, para que ningún uso existente cambie. No lo dupliques ni
cambies su estilo global, y menciónalo en la entrega.

## 5. Implementar
Sigue el adaptador del stack. Traduce el auto-layout de Figma así:

| Figma | Código |
|---|---|
| `flex="row/col"` | flex en dirección fila/columna |
| `gap` / `padding` | gap / padding con la escala de espaciado del proyecto |
| `w="fill"` | ocupar el ancho disponible (`flex-1` / `w-full`) |
| `w="hug"` | ancho según el contenido |
| `justify` / `items` | justify-content / align-items |
| variantes (`size=sm, state=hover`) | props o inputs tipados + estados reales (`:hover`, `:focus-visible`, `disabled`) |
| borde (`stroke`) | **no ocupa espacio en Figma**: usa un borde que no afecte al layout (`ring-1 ring-inset` / `outline`), o resta el grosor del padding |
| interlineado `auto` | ≈ 1.2 × el tamaño de la fuente (`leading-[1.2]`); no confíes en el interlineado por defecto de la utilidad de texto (`text-sm` trae 1.43) |
| interlineado fijo (20) | el valor exacto (`leading-5`) |

Incluye lo que el diseño estático no muestra: estados de foco, `aria-*`, roles y
textos alternativos.

## 6. Comprobar que coincide (QA visual)
1. Levanta la app o el entorno de componentes (Storybook) y abre la vista implementada en el navegador.
2. Haz una captura al mismo ancho que el frame y compárala con la captura de `verify`.
3. **Mide, no solo mires**: compara en el navegador el tamaño y la posición de cada bloque
   (`getBoundingClientRect()`) con las medidas de `verify --measure`. Espera a
   `document.fonts.ready` antes de medir. Una diferencia de 1 px es aceptable (el interlineado
   `auto` de Inter en Figma es ≈1,21 y con `1.2` quedan diferencias de medio píxel).
   En Web Components mide dentro del `shadowRoot`.
   Al comprobar colores tras cambiar de tema, termina antes las transiciones
   (`el.getAnimations().forEach(a => a.finish())`): en una pestaña que no se está pintando no
   avanzan y `getComputedStyle` devuelve todavía el color anterior.
4. Revisa espaciados, tamaños de texto, colores y alineación. Corrige y repite hasta que coincidan.
5. Ejecuta el lint y los tests del proyecto si existen.
6. Si levantaste un servidor de desarrollo, detenlo al terminar o dile al usuario en qué
   puerto quedó corriendo y cómo pararlo.

## Entrega
Lista de archivos creados o modificados, componentes reutilizados, tokens nuevos
propuestos y diferencias que quedaron con el diseño (si las hay), explicando por qué.
