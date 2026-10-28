# Changelog

Cambios de cada versión de figma-steroids. Formato basado en
[Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y versionado
[semántico](https://semver.org/lang/es/).

Casi todas las correcciones salen de pruebas reales contra Figma Desktop con Claude Code y
OpenCode: cuando una skill falla o le cuesta algo, se corrige la skill.

## [0.18.0] - 2026-10-27

### Añadido
- **Antigravity** como plataforma: skills en `.agents/skills` (proyecto) y `~/.gemini/config/skills`
  (global), y el bloque de instrucciones en `AGENTS.md` / `~/.gemini/GEMINI.md`. Rutas tomadas de la
  documentación que trae el propio Antigravity (skill `agy-customizations`). Antigravity no tiene
  subagentes: los agentes van como roles en las instrucciones. `setup` lo detecta solo
  (`~/.gemini/antigravity`) e `init --ai antigravity` lo instala.

### Cambiado
- El mensaje final de `init` y el bloque de instrucciones recomiendan el plugin de figma-steroids
  en lugar de FigCli.

### Probado
- Instalación global en un Antigravity real (Windows): 9 skills en `~/.gemini/config/skills` sin
  tocar las skills propias del usuario, y el bloque en `GEMINI.md`.

## [0.17.0] - 2026-10-27

### Añadido
- `figma-build-ui/scripts/responsive.mjs`: crea las versiones tablet (768) y móvil (390) de una
  pantalla de escritorio, a su derecha y sin tocar la original. Oculta el menú lateral por debajo
  de 1024 px, pasa las tarjetas a 2 columnas o en columna, apila las filas mixtas, hace saltar de
  línea las barras de herramientas, encoge las barras de los gráficos y oculta la cabecera de las
  tablas en móvil. Es una primera pasada para afinar después.
- `figma-consistency-audit/scripts/resolve.mjs`: resuelve en bloque lo que la auditoría deja para
  decidir: redondear el espaciado a la escala (`--round-spacing`, máx. 2 px), añadir un valor a la
  escala (`--add-spacing`), usar una variable para un color (`--color`) y aplicar o crear un estilo
  de texto (`--text`).

### Cambiado
- La auditoría y `resolve` entran también en los componentes: corregir uno arregla sus instancias.

### Probado
- Dashboard de prueba: tras resolver, espaciado al 99 % y texto al 68 % del sistema; versiones de
  768 y 390 px sin nada fuera de la pantalla.

## [0.16.0] - 2026-10-27

### Añadido
- `figma-consistency-audit/scripts/componentize.mjs`: convierte copias hechas a mano (botones,
  badges, inputs…) en un componente con variantes y sustituye cada copia por una instancia, en su
  sitio, con su texto y su tamaño. Agrupa por aspecto y nombra cada variante con su color del
  sistema; `--dry-run` muestra el plan. Va en fases (analizar, crear, sustituir por lotes de 8)
  para no pasar de los 25 s por llamada del plugin, y es seguro repetirlo: reutiliza el componente
  y solo procesa las copias que quedan.

### Probado
- En el dashboard de prueba: 22 badges → componente `Badge` con 7 variantes y 10 botones →
  `Botón dashboard` con 5 variantes. Las dos pantallas quedan idénticas píxel a píxel (PSNR ∞).

## [0.15.0] - 2026-10-26

### Añadido
- Skill **`figma-consistency-audit`** con `scripts/audit.mjs`: revisa todas las páginas del archivo
  frente al design system. Agrupa por valor los colores, textos, espaciados y radios que no usan
  el sistema, con la variable o el estilo exacto (si existe) o el más cercano; detecta copias de
  componentes que deberían ser instancias y botones, inputs o chips dibujados a mano. Da la
  cobertura del sistema en %. `--fix` vincula solo las coincidencias exactas, sin cambiar el aspecto.

### Cambiado
- `figma-build-ui`: si el archivo no tiene design system, pregunta qué estilo usar (importar tus
  colores, un estilo base neutro con variables o una referencia) en lugar de usar shadcn por su
  cuenta. shadcn solo si el usuario lo pide.

### Probado
- Auditoría en un archivo real (3 páginas, 930 elementos): 4 s. `--fix` vinculó 475 espaciados,
  35 textos y 5 radios sin cambiar el aspecto; la cobertura de espaciado pasó del 1 % al 57 % y la
  de texto del 43 % al 56 %.

## [0.14.0] - 2026-10-26

### Añadido
- `figma-steroids setup`: la instalación en un solo comando, en Windows, macOS y Linux. Comprueba
  Node.js, instala figma-cli si falta, pone las skills en cada IA que encuentra (Claude Code, Codex,
  OpenCode, Cursor; sin duplicar si Claude Code ya tiene el plugin), copia el plugin de Figma, deja
  la ruta del `manifest.json` en el portapapeles, abre su carpeta y espera a que el plugin se conecte.
  Opciones `--ai`, `--no-cli`, `--no-open`, `--wait` y `--dry-run`.
- Pruebas de `setup` (detección de IAs, portapapeles y explorador por sistema) y CI ejecuta
  `setup --dry-run` en los tres sistemas.

### Cambiado
- README más corto: qué es, cómo funciona e instalación en 2 pasos; las novedades por versión
  quedan solo aquí.

### Probado
- `setup` en Windows 11: skills en Claude Code, Codex y OpenCode, ruta en el portapapeles, carpeta
  abierta y conexión con el plugin en 4 s. macOS y Linux: pruebas automáticas en CI.

## [0.13.0] - 2026-10-25

### Añadido
- `scripts/from-url.mjs` y `figma-steroids from-url`: de la URL a Figma en un comando. Abre la
  página con Playwright (Edge, Chrome o Chromium), lee los estilos de texto de Figma, ejecuta
  `domToFigmaAsync`, guarda el resultado y lo renderiza con `render-tree`. `--dry-run` solo lee.
- Los iconos SVG que no se identifican se copian del código, con los colores ya resueltos, y se
  dibujan como vector en su sitio (`out.svgs`, `scripts/place-svgs.mjs`, automático en
  `render-tree`).

### Corregido
- `render-tree.mjs`: mover una pieza dentro de su padre se reintenta si la conexión falla un
  momento (antes se paraba en la última pieza).

### Probado
- Dashboard de DentaFlow con `from-url`: lectura en 3 s, 56 piezas, logo e icono de ajustes
  propios como vectores.

## [0.12.0] - 2026-10-25

### Añadido
- Librería de iconos del proyecto (lucide o Material Symbols): `figma-design-system` la detecta y
  la anota, `figma-build-ui` la usa en `<Icon>` y `figma-to-code` traduce cada icono al
  componente de la librería del código.
- `dom-to-figma.js`: reconoce Material Symbols (outlined, rounded, sharp, relleno), Material
  Icons y `<mat-icon>` (texto o `fontIcon`) por su nombre, y los SVG sin nombre comparando su
  forma con lucide (`domToFigmaAsync`, umbral `minScore`). El informe da el parecido, las
  alternativas y el texto cercano de cada icono.

### Probado
- Dashboard de DentaFlow con iconos: 17 de 18 reconocidos por forma; 56 piezas, sin copias.

### Corregido
- `render-tree.mjs`: las piezas que son un solo texto o icono ya no fallan ("must start with
  <Frame>"), y los iconos cuentan más al partir el árbol para que ninguna pieza supere los 90 s.

## [0.11.0] - 2026-10-25

### Probado
- `figma-from-code` con una pantalla real: el dashboard de DentaFlow (proyecto clinica-dent,
  HTML + CSS, 1440×960, ~330 nodos). Resultado prácticamente idéntico al original.

### Añadido
- `scripts/render-tree.mjs`: renderiza pantallas grandes pieza a pieza, borra las copias que
  dejan los reintentos de figma-cli y repite las piezas que superan los 90 s.
- `dom-to-figma.js`: tablas, CSS grid, márgenes (también `margin: auto`) como espaciadores,
  proporciones distintas entre hijos que crecen, textos de una línea con `w="hug"`, árbol de
  piezas (`tree`) y solo variables de color con un prefijo genérico.

### Corregido
- El color del texto ya no sube hasta el `body` cuando un elemento más cercano declara un color
  fijo.
- Un padre "hug" con hijos "fill" (inválido en Figma) ahora lleva su ancho real.

## [0.10.0] - 2026-10-25

### Añadido
- Skill **`figma-from-code`**: reconstruye en Figma una pantalla que ya existe en el código, a
  partir del DOM renderizado. Script `scripts/dom-to-figma.js` (auto-layout, variables leídas
  del CSS, estilos de texto, instancias de componentes, Shadow DOM y `<slot>`), render en dos
  pasos (layout y luego instancias con `--parent`), vinculación de radios y espaciado por valor
  e informe de lo no mapeado.
- El validador comprueba la sintaxis de los scripts de las skills.

### Probado
- Ida y vuelta Figma → React → Figma con la tarjeta de perfil, y la misma lectura en Lit y en
  HTML/CSS: misma estructura, sin colores sueltos.

## [0.9.0] - 2026-10-25

### Añadido
- Adaptador **HTML + CSS + JavaScript** sin framework para `figma-to-code` (`stacks/html.md`):
  HTML semántico, tokens como variables CSS, modificadores de clase, modo oscuro y Web
  Components nativos si el proyecto ya los usa.

### Probado
- `figma-to-code` en **React 19 + Vite 8 + Tailwind 4**, **Lit 3 + TypeScript** y **HTML/CSS/JS**,
  además de Angular: la misma tarjeta coincide con Figma con menos de 1 px y el modo oscuro
  funciona en los cuatro.

### Cambiado
- QA visual: medir dentro del `shadowRoot` en Web Components y terminar las transiciones antes
  de leer colores tras cambiar de tema.
- Adaptador de Lit: propiedades `Array` desde JSON, modo oscuro a través del Shadow DOM, bordes
  que no ocupan espacio y decoradores según la configuración de TypeScript.

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

[0.18.0]: https://github.com/kennedy122112/figma-steroids/compare/v0.17.0...v0.18.0
[0.17.0]: https://github.com/kennedy122112/figma-steroids/compare/v0.16.0...v0.17.0
[0.16.0]: https://github.com/kennedy122112/figma-steroids/compare/v0.15.0...v0.16.0
[0.15.0]: https://github.com/kennedy122112/figma-steroids/compare/v0.14.0...v0.15.0
[0.14.0]: https://github.com/kennedy122112/figma-steroids/compare/v0.13.0...v0.14.0
[0.13.0]: https://github.com/kennedy122112/figma-steroids/compare/v0.12.0...v0.13.0
[0.12.0]: https://github.com/kennedy122112/figma-steroids/compare/v0.11.0...v0.12.0
[0.11.0]: https://github.com/kennedy122112/figma-steroids/compare/v0.10.0...v0.11.0
[0.10.0]: https://github.com/kennedy122112/figma-steroids/compare/v0.9.0...v0.10.0
[0.9.0]: https://github.com/kennedy122112/figma-steroids/compare/v0.8.0...v0.9.0
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
