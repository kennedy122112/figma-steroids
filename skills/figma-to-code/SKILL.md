---
name: figma-to-code
description: Implementa un frame o componente de Figma como código en el stack del proyecto (Angular, React, Lit u otro), reutilizando sus componentes y tokens, y comprueba que el resultado coincide con el diseño. Úsala cuando el usuario diga "implementa este diseño", "pásalo a código", "convierte este frame en un componente", "maqueta esta pantalla", "design to code", "build this Figma frame".
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
| Ninguno de los anteriores | `stacks/generic.md` |

Detecta además: TypeScript o JavaScript (`tsconfig.json`), sistema de estilos
(Tailwind, SCSS, CSS Modules…) y librería de componentes propia o de terceros.
Si un monorepo tiene varios stacks, pregunta en cuál implementar.

## 2. Leer el diseño (independiente del stack)
Parte de la **estructura**, no de código generado:
- `figma-cli extract --selection .figma/selection.md`: layout, medidas, variantes y tokens del frame seleccionado.
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

## 4. Reutilizar antes de crear
Busca en el proyecto componentes equivalentes (botones, inputs, cards…) y úsalos.
Solo crea un componente nuevo si no existe ninguno, y sigue las convenciones del
adaptador y del propio proyecto (nombres, carpetas, estilo de imports).

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

Incluye lo que el diseño estático no muestra: estados de foco, `aria-*`, roles y
textos alternativos.

## 6. Comprobar que coincide (QA visual)
1. Levanta la app o el entorno de componentes (Storybook) y abre la vista implementada en el navegador.
2. Haz una captura al mismo ancho que el frame y compárala con la captura de `verify`.
3. Revisa espaciados, tamaños de texto, colores y alineación. Corrige y repite hasta que coincidan.
4. Ejecuta el lint y los tests del proyecto si existen.

## Entrega
Lista de archivos creados o modificados, componentes reutilizados, tokens nuevos
propuestos y diferencias que quedaron con el diseño (si las hay), explicando por qué.
