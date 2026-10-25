---
name: figma-handoff
description: Prepara la entrega de un diseño de Figma a desarrollo con figma-cli. Exporta PNG/SVG, tokens como CSS, Tailwind o DTCG, la especificación de componentes y anotaciones. Úsala cuando el usuario diga "exporta esto", "pásalo a desarrollo", "handoff", "dame los tokens para el código", "export PNG/SVG".
---

# Handoff a desarrollo

Requisito: conexión activa (skill `figma-connect`).

## Qué exportar
- **Imágenes:** `figma-cli export node "<id>" -f png|svg|pdf|jpg -s 2 -o <archivo>`.
  Para una captura rápida de la selección: `figma-cli export screenshot`.
- **Código:** `figma-cli export-jsx "<id>"` (JSX/React) y `figma-cli export-storybook "<id>"` (historias de Storybook).
- **Tokens:** `figma-cli export css`, `figma-cli export tailwind` o `figma-cli export dtcg tokens.json`.
- **Especificación de un componente:** `figma-cli spec <Componente>` (ejes de variantes, tamaños y el identificador para reutilizarlo).
- **Sistema completo:** `figma-cli extract` (genera `DESIGN.md` para que otras IAs construyan con el mismo sistema).

## Dónde guardar
Guarda los archivos en `handoff/<nombre-de-la-pantalla>/` dentro del proyecto del
usuario, salvo que te indique otra ruta. No sobrescribas exportaciones anteriores sin avisar.

## Entrega
Termina con un resumen de lo exportado: ruta, contenido de cada archivo y qué
tokens o componentes usa la pantalla. Si un componente no tiene variables
vinculadas (usa colores fijos), avísalo, porque generará deuda en el código.
