---
name: figma-design-system
description: Gestiona el design system en Figma con figma-cli. Importa tokens desde DESIGN.md, Tailwind, CSS o tokens.json como variables reales; completa el sistema con escala de espaciado, escala tipográfica (estilos de texto) y un componente Button con variantes y estados; exporta a DESIGN.md o DTCG, y lo congela con snapshot / rules / check. Úsala cuando el usuario diga "importa mis colores", "carga el design system", "crea la escala de espaciado", "crea estilos de texto", "haz un componente de botón", "exporta los tokens", "¿cambió algo?", o quiera validar el sistema en CI.
---

# Design system en Figma

Requisito: conexión activa (skill `figma-connect`).

## Importar (código → Figma)
`figma-cli import <fuente>`, donde la fuente puede ser:
- `DESIGN.md`
- `tailwind.config.js`
- `globals.css` / `styles.css` (incluye HSL de shadcn, `@theme` de Tailwind v4 y oklch)
- `tokens.json` (W3C / Style Dictionary / Tokens Studio, con alias)
- `http://localhost:6006` (Storybook: solo trae el inventario de componentes, no tokens)

Después muéstralo en el lienzo con `figma-cli var visualize`, si el usuario quiere verlo.

## Completar el sistema
Un sistema con solo colores deja que cada diseño invente tamaños de letra, espaciados y
botones. Antes de completar, mira qué se usa de verdad:
`figma-cli analyze typography`, `figma-cli analyze spacing` y `figma-cli analyze clusters`
(patrones repetidos que deberían ser componentes). Propón el plan al usuario antes de crear.

### 1. Escala de espaciado
- `figma-cli tokens spacing` crea la colección `Spacing` con la escala de 4 px
  (`spacing/1`=4, `spacing/2`=8, `spacing/3`=12, `spacing/4`=16, `spacing/5`=20…).
  Si ya existe una colección de espaciado, úsala en lugar de crear otra.
- Vincula los diseños: `figma-cli bind gap spacing/5 -n "<id>"` y
  `figma-cli bind padding spacing/7 -n "<id>"` (`-s top|right|bottom|left` para un solo lado).
- Un valor fuera de la escala (14, 5…) es una señal: redondéalo al paso más cercano y avísalo.

### 2. Escala tipográfica (estilos de texto)
No hay comando para crear estilos de texto: se crean con `eval`. Deriva la escala de
`analyze typography` (agrupa tamaños casi iguales; 5–7 estilos suelen bastar) y usa la
fuente que ya usa el archivo. Este ejemplo no duplica estilos que ya existan:
```
figma-cli eval 'const scale=[["Display",40,"Bold",48],["Title",20,"Semi Bold",24],["Subtitle",16,"Semi Bold",20],["Body",14,"Regular",20],["Body Strong",14,"Semi Bold",20],["Caption",12,"Regular",16]]; const existing=(await figma.getLocalTextStylesAsync()).map(s=>s.name); const created=[], skipped=[]; for (const [name,size,style,lh] of scale){ const full="Text/"+name; if(existing.includes(full)){ skipped.push(full); continue } await figma.loadFontAsync({family:"Inter",style}); const s=figma.createTextStyle(); s.name=full; s.fontName={family:"Inter",style}; s.fontSize=size; s.lineHeight={unit:"PIXELS",value:lh}; created.push(full) }; ({created, skipped})'
```
Después, los diseños usan `<Text textStyle="Text/Body">` en `render`, en vez de `size`/`weight`.

### 3. Componente Button con variantes y estados
1. Genera un frame por combinación, nombrado `variant=…, size=…, state=…`
   (por ejemplo 2 variantes × 2 tamaños × 4 estados = 16). Usa variables para colores,
   `textStyle` para el texto, y alto ≥ 44 px (40 para `sm`, solo si el sistema lo usa).
   Estados: `hover` (fondo de hover u `opacity={0.9}`), `focus` (trazo de 2 px visible),
   `disabled` (`opacity={0.5}`).
2. Renderiza **en lotes de 4** en su propia página:
   `figma-cli render-batch -f lote.json --page "Design System"`.
   Un `render-batch` de 16 con `--variant-set` en una sola llamada supera el tiempo límite
   (90 s) y deja el trabajo a medias.
3. Combínalos: `figma-cli variants from auto --multi --name Button` (en la página donde están).
4. Vincula radio y padding de todas las variantes a las variables (`bind radius` /
   `bind padding` por variante, o un `eval` con `setBoundVariable` sobre los hijos del set).
5. Compruébalo colocando una instancia:
   `<Instance component="Button" variant="variant=primary, size=md, state=default" text="Guardar" />`.

Si una llamada se corta a medias, borra solo lo que creaste en esa llamada antes de repetirla.

## Exportar (Figma → código)
- Todo el sistema: `figma-cli extract` (genera `DESIGN.md`).
- Solo tokens: `figma-cli extract --sections tokens`.
- Formatos: `figma-cli export dtcg tokens.json` · `figma-cli export css` · `figma-cli export tailwind`.
- Si los colores salen blancos porque vienen de una librería compartida: `figma-cli extract --resolve-remote`.

## Contrato y detección de cambios (sin IA)
1. `figma-cli snapshot` genera `design.json`. Hazle commit.
2. `figma-cli rules gen` genera `rules/*.yaml`, un contrato por componente. Revísalos como un diff.
3. `figma-cli check` compara el archivo con los contratos y sale con 1 si encuentra cambios. Para CI usa `--json`.
4. `figma-cli check --roundtrip` comprueba que los tokens sobreviven a una exportación y reimportación.

Un rojo en `check` significa que **algo cambió**, no necesariamente que esté mal.
Si el cambio era intencional, vuelve a ejecutar `snapshot` y revisa el diff con el usuario.

## Reglas
- Nunca sobrescribas ni borres variables existentes sin confirmación del usuario.
- Respeta los nombres de colecciones y modos (light/dark) que ya existen.
