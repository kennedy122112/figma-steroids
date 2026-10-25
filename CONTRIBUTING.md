# Cómo contribuir

Cualquiera puede mejorar las skills y los agentes. No hace falta saber programar:
son archivos Markdown con instrucciones para el agente de IA
(Claude Code, Codex, OpenCode, Cursor…).

## Estructura

```
.claude-plugin/   manifiestos del plugin (plugin.json y marketplace.json)
skills/<nombre>/SKILL.md   una carpeta por skill
agents/<nombre>.md         un archivo por agente
platforms.json             dónde instalar en cada herramienta
lib/installer.mjs          instalador y conversores de formato de agentes
bin/figma-steroids.mjs     CLI (init, update, uninstall, list)
tests/                     pruebas del instalador
templates/        plantillas para empezar
scripts/validate.mjs       validador (también corre en CI)
```

## Añadir una skill
1. Copia `templates/SKILL.template.md` a `skills/<nombre-en-kebab-case>/SKILL.md`.
2. El `name` del frontmatter debe ser igual al nombre de la carpeta.
3. La `description` es lo más importante: el agente decide si cargar la skill leyendo
   **solo esa línea**. Di qué hace y cuándo usarla, con frases reales del usuario
   (en español y en inglés).
4. Usa solo comandos de figma-cli que existan; compruébalos con `figma-cli <comando> --help`.
5. No escribas instrucciones que solo funcionen en una herramienta: las skills se instalan
   también en Codex, OpenCode y Cursor.

## Añadir un agente
1. Copia `templates/AGENT.template.md` a `agents/<nombre>.md`.
2. El `name` debe ser igual al nombre del archivo.
3. Limita `tools` a lo que necesita. Un revisor no necesita `Write`. El instalador usa este
   campo para convertir permisos (por ejemplo, en OpenCode `edit: deny` si no hay `Write`/`Edit`).
4. Define con claridad qué devuelve, porque su respuesta la lee otro agente, no una persona.

## Añadir un stack a `figma-to-code`
1. Crea `skills/figma-to-code/stacks/<stack>.md` (por ejemplo `vue.md`, `svelte.md`, `flutter.md`).
   Usa `angular.md` o `lit.md` como modelo.
2. Debe empezar con `# Adaptador: <stack>` y tener una sección `## Detección`
   que diga cómo reconocer el stack en un proyecto.
3. Añade una fila a la tabla de detección en `skills/figma-to-code/SKILL.md`, enlazando `stacks/<stack>.md`.
4. Prioriza las convenciones del proyecto del usuario sobre las tuyas: el adaptador
   explica el stack, pero el proyecto manda.

## Añadir una herramienta (plataforma)
1. Busca en la documentación **oficial** de la herramienta dónde lee las skills, los agentes y
   las instrucciones (proyecto y carpeta del usuario). No copies rutas de otros proyectos.
2. Añade una entrada a `platforms.json` con esas rutas y los enlaces en `docs`
   (el validador exige al menos uno).
3. Si sus agentes usan un formato nuevo, añade un conversor en `AGENT_FORMATS`
   (`lib/installer.mjs`). Si no tiene subagentes, pon `"agents": null`: los agentes se
   instalarán como roles dentro de su archivo de instrucciones.
4. `npm test` prueba automáticamente cada plataforma de `platforms.json`, en proyecto y global.

## Probar en local
Desde la raíz de la repo:
```bash
claude --plugin-dir .
```
Así Claude Code carga las skills y los agentes de tu copia local. Para otras herramientas,
instala tu copia en un proyecto de prueba:
```bash
node bin/figma-steroids.mjs init --ai codex
```
Pruébalos con Figma abierto y el plugin FigCli en marcha.

## Antes del pull request
```bash
npm run validate && npm test
```
- Si cambias el comportamiento de una skill o un agente, sube la versión en todos los
  manifiestos: `package.json`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`,
  `plugin.json` y `.cursor-plugin/plugin.json` (deben coincidir; el validador lo comprueba).
- Describe en el pull request qué probaste en Figma y con qué resultado.

## Reglas que todas las skills respetan
- Nunca borrar nodos ni variables que el usuario ya tenía.
- Crear nodos visuales con `render` / `render-batch`, no con `eval`.
- Usar variables del design system antes que colores fijos.
- Verificar el resultado (`figma-cli verify --measure`) antes de darlo por terminado.
- No mostrar comandos de terminal al usuario.
