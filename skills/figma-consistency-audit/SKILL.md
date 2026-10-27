---
name: figma-consistency-audit
description: Revisa la coherencia de un archivo de Figma completo frente a su design system (todas las páginas) y propone o aplica correcciones seguras. Encuentra colores, textos, espaciados y radios fuera del sistema, agrupados por valor y con la variable o el estilo que corresponde; copias de componentes que deberían ser instancias, y botones o campos dibujados a mano. Úsala cuando el usuario diga "revisa la coherencia de mi archivo", "¿qué se sale del design system?", "audita el archivo", "limpia los colores sueltos", "vincula todo a las variables", "consistency audit".
---

# Auditoría de coherencia del archivo

Requisito: conexión activa (skill `figma-connect`). Si el archivo no tiene design system
(variables, estilos de texto o componentes), dilo y propón crearlo primero con
`figma-design-system`: sin sistema no hay contra qué comparar.

## 1. Auditar (solo lectura)
```
node scripts/audit.mjs --out auditoria.json
```
`--page "<nombre>"` limita a una página (útil en archivos muy grandes, o si figma-cli tarda
más de 90 s). El informe se lee por partes, así que no le afecta el límite de 20 000
caracteres de `figma-cli eval`. El informe trae:

| Campo | Qué es |
|---|---|
| `coverage` | % de colores, textos, espaciados y radios que ya usan el sistema |
| `colors` | Colores sin vincular, agrupados: `token` si existe una variable con ese valor exacto (solo falta vincular), si no `nearest` (la más parecida) |
| `text` | Textos sin estilo: `style` si uno coincide exactamente, si no `nearest` |
| `spacing` / `radius` | Gaps, paddings y radios sin vincular, con el token exacto o el más cercano |
| `copies` | Frames que se llaman como un componente pero no son instancias |
| `handmade` | Botones, inputs, chips… dibujados a mano, agrupados por tamaño, radio y color |

Cada grupo trae `count` y ejemplos con su pantalla (`Página / Pantalla › capa`).

## 2. Contárselo al usuario (sin jerga)
Empieza por la cobertura ("el 72 % de los colores usa tus variables") y sigue con lo que más
pesa, de más a menos repeticiones. Separa siempre dos grupos:

1. **Se arregla solo** (coincidencia exacta con el sistema): vincular no cambia el aspecto.
2. **Hay que decidir** (sin coincidencia exacta): un color que no está en la paleta, un texto de
   15 px cuando la escala salta de 14 a 16, un botón hecho a mano. Para cada uno propone una
   opción concreta: usar el token más cercano (dilo: "cambiaría de #0F9F9A a primary #0E9F9A"),
   añadirlo al sistema si se repite mucho, o dejarlo si es intencional.

Las `copies` y los `handmade` repetidos son los que más deuda generan: propón sustituirlos por
instancias del componente (o crear el componente si no existe, con `figma-design-system`).

## 3. Corregir lo seguro (con permiso)
Pregunta antes y después ejecuta:
```
node scripts/audit.mjs --fix --out auditoria-despues.json
```
Solo vincula lo que coincide **exactamente** y sin ambigüedad: colores, espaciados y radios a la
única variable que tiene ese valor, y el estilo de texto que coincide en fuente, tamaño, peso,
interlineado, interletrado, mayúsculas y subrayado. Nada cambia de aspecto. Si varias variables
tienen el mismo valor, el informe lo marca como `ambiguo: a | b` y no lo toca: pregunta cuál es la
semántica correcta (un texto oscuro es `foreground`, no `card`, aunque valgan lo mismo). Las
colecciones de tema oscuro (`… · Dark`) no se usan para emparejar. El campo `fixed` dice cuántos se vincularon, y
`coverage` cómo quedó.

Lo que necesita decisión no se toca sin confirmación, una por una o por grupo
("¿cambio los 12 textos de 15 px a Text/Body de 16 px?"). Para esos cambios usa `eval` sobre los
IDs de los ejemplos, o pídele al usuario que lo revise en el lienzo.

## Reglas
- La auditoría no modifica nada; `--fix` solo vincula coincidencias exactas.
- No borres ni sustituyas capas del usuario sin confirmación (copias, botones a mano).
- Un avatar circular no cuenta como radio fuera de escala (el script ya lo ignora); los
  componentes por dentro tampoco (se revisan en el propio componente, no en sus instancias).
- Si `figma-cli` tarda demasiado en un archivo grande, audita página por página.
