# Changelog

Cambios de cada versión de figma-steroids. Formato basado en
[Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y versionado
[semántico](https://semver.org/lang/es/).

Casi todas las correcciones salen de pruebas reales contra Figma Desktop con Claude Code y
OpenCode: cuando una skill falla o le cuesta algo, se corrige la skill.

## [0.8.0] - 2026-10-25

### Añadido
- **Modo claro / oscuro** en `figma-design-system`: modos `Light`/`Dark` en planes de pago, o
  una colección paralela `… · Dark` en el plan gratuito (que solo permite un modo por
  colección); vista previa en una copia del diseño con `figma-cli use`; revisión de contraste;
  exportación de bloques `:root` / `.dark`.
- `figma-to-code`: cómo llevar el tema oscuro a Tailwind v4 (`.dark` y `@custom-variant`).

## [0.7.0] - 2026-10-25

### Añadido
- **Plugin de Figma propio** (`figma-plugin/`), basado en FigCli: archivo conectado, selección
  con ID para copiar, registro de actividad (lecturas, nodos creados / modificados / borrados,
  errores), botón de **pausa**, **Ver en el lienzo**, registro guardado por archivo y botón
  para copiarlo.
- Comando `figma-steroids plugin`: copia el plugin a `~/.figma-steroids/figma-plugin` y
  muestra la ruta de su manifiesto.
- `figma-connect` sabe qué hacer si el usuario pausa o si hay dos plugins abiertos.

### Corregido
- El manifiesto usa el permiso de red de FigCli: Figma rechaza `127.0.0.1` en
  `devAllowedDomains`.

## [0.6.0] - 2026-10-25

### Añadido
- `figma-design-system` completa el sistema: escala de espaciado, estilos de texto y un
  componente `Button` con variantes, tamaños y estados.
- `figma-build-ui` usa los estilos de texto y el espaciado cuando existen.
- README: sección "Probado en".

## [0.5.2] - 2026-10-25

### Corregido (prueba en Claude Code)
- `figma-build-ui`: controles interactivos de 44 px mínimo, copiar las medidas de botones
  sueltos existentes, icono alineado arriba en filas de varias líneas y títulos con truncado.
- `figma-to-code`: cargar todos los pesos de la fuente que usa el diseño.

## [0.5.1] - 2026-10-25

### Corregido (pruebas en OpenCode Desktop)
- `figma-connect`: daemon con el token desincronizado.
- `figma-build-ui`: cómo leer los valores de las variables, `bind radius`, `justify="between"`
  ignora `gap` y comprobación de rellenos, trazos y radios vinculados.
- `figma-a11y-review`: falsos positivos conocidos.
- `figma-to-code`: extender componentes de forma compatible y avisar de los servidores que se
  quedan corriendo.

## [0.5.0] - 2026-10-25

### Añadido
- Skill `figma-setup`: primer arranque sin terminal (Node.js, figma-cli, Figma, plugin).
- README: tabla "¿Dónde funciona?" (apps locales sí; chat y nube no).

## [0.4.1] - 2026-10-25

### Corregido (primera prueba real en Figma y en Angular)
- `figma-build-ui`: `rounded` solo acepta números, `eval` con la API async.
- `figma-a11y-review`: auditoría por nodo y `a11y focus`.
- `figma-to-code`: qué variable usa cada nodo, tipografía, bordes que no ocupan espacio,
  interlineado y QA visual midiendo.

## [0.4.0] - 2026-10-25

### Añadido
- Plugin para **Codex** (`plugin.json` portable y `.agents/plugins/marketplace.json`) y
  manifiesto para **Cursor** (`.cursor-plugin/`).

## [0.3.0] - 2026-10-25

### Añadido
- Instalador `figma-steroids init` para **Claude Code, Codex, OpenCode, Cursor** y el destino
  universal, con `update`, `uninstall`, `list`, `--global`, `--dry-run` y `--force`.
- Tests del instalador en Windows, macOS y Linux.

## [0.2.1] - 2026-10-25

### Cambiado
- README rediseñado: badges, banner, diagrama, tablas y solución de problemas.

## [0.2.0] - 2026-10-25

### Añadido
- Skill `figma-to-code` con adaptadores para Angular, React, Lit y uno genérico.

## [0.1.0] - 2026-10-25

### Añadido
- Primera versión: 5 skills, 3 agentes, plugin de Claude Code, plantillas, guía de
  contribución y validador.

[0.8.0]: https://github.com/kennedy122112/figma-steroids/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/kennedy122112/figma-steroids/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/kennedy122112/figma-steroids/compare/v0.5.2...v0.6.0
[0.5.2]: https://github.com/kennedy122112/figma-steroids/compare/v0.5.1...v0.5.2
[0.5.1]: https://github.com/kennedy122112/figma-steroids/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/kennedy122112/figma-steroids/compare/v0.4.1...v0.5.0
[0.4.1]: https://github.com/kennedy122112/figma-steroids/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/kennedy122112/figma-steroids/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/kennedy122112/figma-steroids/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/kennedy122112/figma-steroids/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/kennedy122112/figma-steroids/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/kennedy122112/figma-steroids/releases/tag/v0.1.0
