---
name: figma-build-ui
description: Construye pantallas, componentes y layouts reales y editables en Figma Desktop con figma-cli (render / render-batch), usando las variables del design system cargado en lugar de colores fijos. Úsala cuando el usuario pida "crea / diseña / arma X en Figma", "haz 3 tarjetas", "una pantalla de login", "un dashboard", "build X in Figma", o quiera editar algo que ya existe en el lienzo.
---

# Construir UI en Figma

Requisito: conexión activa (skill `figma-connect`).

## Antes de construir
1. Mira qué hay: `figma-cli canvas info` y `figma-cli var list`.
2. Si existe un design system (variables o componentes), **úsalo**. Busca si el
   componente ya existe (`figma-cli find "<Nombre>"`) y, si existe, coloca una
   instancia con `figma-cli instantiate "<Nombre>"` en lugar de reconstruirlo.
   Si hay un `DESIGN.md` extraído, `figma-cli spec <Nombre>` da sus variantes exactas.
   Si no hay componente pero sí **copias sueltas** del mismo elemento en otros diseños (botones
   dibujados a mano, por ejemplo), **copia sus medidas** (alto, radio, tamaño de texto,
   padding) para no crear una variante más, y propón convertirlo en componente.
3. Lee la intención del usuario:
   - "con mis variables / con el design system / themed" → `render` con `var:`.
   - Solo "crea 3 botones", sin design system cargado → puedes usar `figma-cli shadcn add button --count 3`.
     `shadcn add` ignora tus variables, así que no lo uses si hay un sistema propio cargado.

## Reglas de oro
1. Crea nodos visuales con `render` o `render-batch`, **nunca** con `eval`
   (`eval` no posiciona y se salta las protecciones). Reserva `eval` para operaciones
   de la Plugin API que no tengan subcomando.
2. "N tarjetas" = N nodos de primer nivel: `render-batch '[ "<Frame…>", … ]'`.
3. **Nunca borres nodos que ya existían.** Para deshacer lo tuyo: `figma-cli undo`.
4. Colores con `var:nombre`, no con hex, cuando haya variables. `var:` solo sirve en
   `bg`, `color` y `stroke`: `rounded` acepta **un número** (`rounded="var:radius"` hace
   fallar el render). `figma-cli var list` no muestra valores; obtenlos con:
   ```
   figma-cli eval 'const out={}; for (const v of await figma.variables.getLocalVariablesAsync()) { const val=Object.values(v.valuesByMode)[0]; out[v.name]= v.resolvedType==="COLOR" ? "#"+[val.r,val.g,val.b].map(c=>Math.round(c*255).toString(16).padStart(2,"0")).join("") : val; }; ({...out})'
   ```
   y usa el número, por ejemplo `rounded={12}`. Después del render, **vincula el radio a la
   variable** en cada nodo cuyo radio sea el del token:
   `figma-cli bind radius <variable> -n "<id>"` (igual existen `bind gap` y `bind padding`
   para variables numéricas de espaciado; `figma-cli bind list -t FLOAT` las lista).
   No vincules formas que no siguen la escala: un avatar circular (radio = mitad del lado)
   dejaría de ser un círculo.
5. Iconos reales: `<Icon name="lucide:home" size={20} />`, nunca emojis.
   **Controles interactivos** (botones, enlaces con área, inputs): alto fijo mínimo de
   **44 px** (40 solo si el sistema ya lo usa), nunca `h="hug"` sobre el texto. Usa padding de
   la escala del archivo (4, 8, 12, 16…), no valores sueltos como 14.
6. Verifica siempre: `figma-cli verify "<id>" --measure` y corrige si el tamaño no cuadra.
   Si hay controles interactivos, ejecuta también `figma-cli a11y touch "<id>"`.
   La captura se guarda en `/tmp` por defecto; en Windows indica la ruta con `--save "<ruta>.png"`.
7. Si las variables están cargadas, comprueba que rellenos, trazos y radios quedaron vinculados.
   El radio se vincula **por esquina** (`topLeftRadius`…), no como `cornerRadius`:
   ```
   figma-cli eval 'const n=await figma.getNodeByIdAsync("<id>"); const miss=[]; let total=0; const w=(x)=>{ const b=x.boundVariables||{}; if((x.fills||[]).some(f=>f.visible!==false)){ total++; if(!b.fills) miss.push("fill: "+x.name) } if((x.strokes||[]).length){ total++; if(!b.strokes) miss.push("stroke: "+x.name) } if(x.cornerRadius){ total++; if(!b.topLeftRadius) miss.push("radius: "+x.name) } (x.children||[]).forEach(w) }; w(n); ({total, sinVincular:miss})'
   ```
   Algo sin vincular a propósito (como un avatar circular) se explica en la entrega.
   En `eval` usa siempre las variantes **async** de la API (`getNodeByIdAsync`): el plugin
   trabaja con `documentAccess: dynamic-page` y las síncronas fallan.

## JSX mínimo
```jsx
<Frame name="Card" flex="col" gap={12} p={24} w={320} bg="var:card" rounded={12}>
  <Text size={18} weight="semibold" color="var:foreground" w="fill">Título</Text>
  <Text size={14} color="var:muted-foreground" w="fill">Texto que envuelve.</Text>
  <Instance component="Button" variant="size=md" text="Guardar" />
</Frame>
```
- Layout: `flex="row|col" gap p px py justify="between" items="center"`
- `justify="between"` **ignora `gap`**: reparte todo el espacio libre. Para columnas iguales
  (estadísticas, rejillas) usa `gap` + hijos con `w="fill"`, sin `between`.
- Tamaño: `w={320}` · `w="fill"` · `w="hug"` · `w="50%"`
- **Texto que envuelve:** el padre y cada `<Text>` necesitan `w="fill"`, y el padre necesita `flex`.
- **Fila con icono + texto de varias líneas:** `items="start"`, para que el icono quede a la
  altura de la primera línea y no centrado en el bloque.
- **Título con algo a la derecha** (hora, badge): el título con `w="fill"` y `truncate`
  (o `maxLines={1}`), para que un texto largo no choque con lo de al lado.
- En otra página: `figma-cli render --page "Nombre" '<Frame…>'`.

## Componentes y variantes
- Convertir en componente: `figma-cli node to-component "<id>"`.
- Set de variantes: `render-batch '["<Frame name=\"size=sm, state=default\" …>", …]' --variant-set Button`.
- Si viene de un DESIGN.md extraído: `figma-cli spec <Componente> --check <id>`. Si sale con código distinto de 0, la tarea **no** está terminada.

Al terminar, cuéntale al usuario qué creaste y dónde, sin mostrarle los comandos.
