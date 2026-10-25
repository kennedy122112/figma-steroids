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
4. Colores con `var:nombre`, no con hex, cuando haya variables.
5. Iconos reales: `<Icon name="lucide:home" size={20} />`, nunca emojis.
6. Verifica siempre: `figma-cli verify "<id>" --measure` y corrige si el tamaño no cuadra.

## JSX mínimo
```jsx
<Frame name="Card" flex="col" gap={12} p={24} w={320} bg="var:card" rounded={12}>
  <Text size={18} weight="semibold" color="var:foreground" w="fill">Título</Text>
  <Text size={14} color="var:muted-foreground" w="fill">Texto que envuelve.</Text>
  <Instance component="Button" variant="size=md" text="Guardar" />
</Frame>
```
- Layout: `flex="row|col" gap p px py justify="between" items="center"`
- Tamaño: `w={320}` · `w="fill"` · `w="hug"` · `w="50%"`
- **Texto que envuelve:** el padre y cada `<Text>` necesitan `w="fill"`, y el padre necesita `flex`.
- En otra página: `figma-cli render --page "Nombre" '<Frame…>'`.

## Componentes y variantes
- Convertir en componente: `figma-cli node to-component "<id>"`.
- Set de variantes: `render-batch '["<Frame name=\"size=sm, state=default\" …>", …]' --variant-set Button`.
- Si viene de un DESIGN.md extraído: `figma-cli spec <Componente> --check <id>`. Si sale con código distinto de 0, la tarea **no** está terminada.

Al terminar, cuéntale al usuario qué creaste y dónde, sin mostrarle los comandos.
