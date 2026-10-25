---
name: figma-design-system
description: Gestiona el design system en Figma con figma-cli. Importa tokens desde DESIGN.md, Tailwind, CSS o tokens.json como variables reales; completa el sistema con escala de espaciado, escala tipográfica (estilos de texto), un componente Button con variantes y estados, y modo claro / oscuro; exporta a DESIGN.md o DTCG, y lo congela con snapshot / rules / check. Úsala cuando el usuario diga "importa mis colores", "carga el design system", "crea la escala de espaciado", "crea estilos de texto", "haz un componente de botón", "añade modo oscuro", "dark mode", "tema oscuro", "exporta los tokens", "¿cambió algo?", o quiera validar el sistema en CI.
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

### 4. Modo claro / oscuro (temas)
figma-cli no tiene comando para modos, y `figma-cli import` **ignora** los bloques `.dark` del
CSS: el tema oscuro se crea con `eval`. Antes, propón la paleta oscura al usuario (fondos
oscuros, textos claros y un `primary` más luminoso que siga teniendo contraste).

**Elige la vía según el plan de Figma.** Intenta añadir un modo a la colección
(`col.addMode("Dark")`); si falla con `Limited to 1 modes only`, el plan del usuario (el
gratuito) solo permite un modo por colección: usa una **colección paralela**.

- **Con modos (planes de pago):** renombra el modo actual a `Light`, añade `Dark` y da a cada
  variable su valor oscuro con `setValueForMode`. Lo que no tenga valor oscuro copia el claro;
  lístalo en la entrega.
- **Colección paralela (cualquier plan):** crea `<colección> · Dark` con **los mismos nombres**
  de variable y los valores oscuros (este `eval` es idempotente y copia los que falten):
  ```
  figma-cli eval 'const dark={"background":"#0b1120","foreground":"#f1f5f9","card":"#111827","card-foreground":"#f1f5f9","primary":"#2dd4bf","primary-foreground":"#042f2e","muted":"#1e293b","muted-foreground":"#94a3b8","border":"#334155"}; const cols=await figma.variables.getLocalVariableCollectionsAsync(); const src=cols.find(c=>c.name==="<colección>"); const name=src.name+" · Dark"; let dst=cols.find(c=>c.name===name); if(!dst) dst=figma.variables.createVariableCollection(name); const existing={}; for (const id of dst.variableIds){ const v=await figma.variables.getVariableByIdAsync(id); existing[v.name]=v } const hex=(h)=>({r:parseInt(h.slice(1,3),16)/255,g:parseInt(h.slice(3,5),16)/255,b:parseInt(h.slice(5,7),16)/255,a:1}); const mode=dst.modes[0].modeId; const set=[], copied=[]; for (const id of src.variableIds){ const s=await figma.variables.getVariableByIdAsync(id); const v=existing[s.name]||figma.variables.createVariable(s.name, dst, s.resolvedType); if(dark[s.name]){ v.setValueForMode(mode, hex(dark[s.name])); set.push(s.name) } else { v.setValueForMode(mode, Object.values(s.valuesByMode)[0]); copied.push(s.name) } }; ({collection:name, set, copiedFromLight:copied})'
  ```

**Previsualizar sin tocar el original:** duplica el frame a su derecha
(`const c=n.clone(); c.x=<borde derecho>+80`) y cambia la copia de tema:
- con modos: `c.setExplicitVariableModeForCollection(col, darkModeId)`;
- con colección paralela: `figma-cli use "<colección> · Dark" -n "<id de la copia>"`
  (prueba antes con `--dry-run`: dice cuántas vinculaciones va a cambiar).

Verifica el tema oscuro con `figma-cli a11y contrast "<id de la copia>"`: un color que
funciona sobre blanco puede fallar sobre fondo oscuro.

**Exportar los temas al código:** `export css` y `export dtcg` **mezclan las colecciones**
(el CSS repite cada variable en el mismo `:root` y el oscuro pisa al claro; el DTCG pierde el
oscuro). Genera los bloques con este `eval` de solo lectura (ajusta `PREFIX`: `--color-` para
el `@theme` de Tailwind v4, `--` para variables CSS simples):
```
figma-cli eval 'const LIGHT="<colección>", DARK="<colección> · Dark", PREFIX="--color-"; const cols=await figma.variables.getLocalVariableCollectionsAsync(); const read=async(name)=>{ const c=cols.find(x=>x.name===name); const out={}; for (const id of c.variableIds){ const v=await figma.variables.getVariableByIdAsync(id); if(v.resolvedType!=="COLOR") continue; const val=Object.values(v.valuesByMode)[0]; out[v.name]="#"+[val.r,val.g,val.b].map(x=>Math.round(x*255).toString(16).padStart(2,"0")).join("") } return out }; const l=await read(LIGHT), d=await read(DARK); const block=(sel,o)=>sel+" {\n"+Object.entries(o).map(([k,v])=>"  "+PREFIX+k+": "+v+";").join("\n")+"\n}"; block(":root",l)+"\n\n"+block(".dark",d)'
```
Con modos, lee `valuesByMode[lightId]` y `valuesByMode[darkId]` de la misma colección.

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
