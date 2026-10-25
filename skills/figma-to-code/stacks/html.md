# Adaptador: HTML + CSS + JavaScript (sin framework)

## Detección
- Hay archivos `.html`, `.css` y `.js` y **ningún framework** en `package.json` (o no hay
  `package.json`): sitios estáticos, landing pages, prototipos, plantillas de un CMS o páginas
  sueltas dentro de otro sistema.
- Si hay `vite` sin framework, es este mismo stack con un servidor de desarrollo.
- Mira cómo se cargan los estilos: hojas CSS propias, un preprocesador (`.scss`) o Tailwind
  (por CDN `<script src="https://cdn.tailwindcss.com">` o compilado).

## Convenciones del proyecto primero
Abre 2 o 3 piezas parecidas y copia su estilo: nombres de clase (BEM `card__title`,
utilidades, prefijos), un CSS por componente o uno global, dónde viven las variables y si el
JavaScript usa módulos (`type="module"`) o scripts sueltos.

## Componente
- **HTML semántico:** `<article>` para una tarjeta, `<header>`, `<h2>`/`<h3>` según la jerarquía
  de la página, `<ul>`/`<li>` para listas, `<dl>` para pares etiqueta / valor, `<button>` para
  acciones y `<a>` para navegar. Nunca un `<div>` con `onclick`.
- **Variantes de Figma → modificadores de clase:** `btn btn--primary btn--sm` (o el patrón del
  proyecto). Los estados reales con pseudoclases: `:hover`, `:focus-visible`, `:disabled`,
  `[aria-pressed="true"]`.
- **Contenido repetido** (listas, tarjetas iguales): si el proyecto genera HTML con JavaScript,
  usa `<template>` y `cloneNode`; si es estático, escribe el HTML.
- **Reutilizable en varias páginas:** si el proyecto ya usa Web Components nativos
  (`customElements.define`), crea uno; si no, una clase CSS con su estructura HTML documentada.
- **Iconos:** SVG en línea con `aria-hidden="true"` (o el sistema de iconos que ya use el proyecto).

## Estilos
- **Tokens como variables CSS** en `:root` (`--color-primary`, `--radius-card`…) y usadas con
  `var(--color-primary)`. Nada de hex sueltos en las reglas de los componentes.
- **Modo oscuro:** redefine las variables en `.dark { … }` (activado con una clase en `<html>`)
  y, si el proyecto quiere seguir al sistema, en `@media (prefers-color-scheme: dark)`.
- **Layout:** el auto-layout de Figma es `display: flex` con `gap`; `w="fill"` es `flex: 1` o
  `width: 100%`. Usa `box-sizing: border-box`.
- **Bordes:** el trazo de Figma no ocupa espacio; usa `box-shadow: inset 0 0 0 1px var(--color-border)`
  u `outline` para que el borde no reste del padding.
- Si el proyecto usa Tailwind, sigue el adaptador de React o Angular para las clases: los
  tokens van en el `@theme` y el modo oscuro en `.dark`.

## Accesibilidad
- Orden del DOM igual al orden visual, foco visible y texto alternativo en las imágenes.
- Los elementos interactivos creados con JavaScript necesitan `role`, `tabindex` y manejo de
  teclado; por eso es mejor usar el elemento nativo.

## Verificación
- Sin build: abre la página con un servidor local estático (`npx serve`, la extensión del
  editor o el servidor de desarrollo del proyecto) y mide contra Figma.
- Valida el HTML si el proyecto tiene un validador o linter configurado.
