# Cómo contribuir

Cualquiera puede mejorar las skills y los agentes. No hace falta saber programar:
son archivos Markdown con instrucciones para Claude.

## Estructura

```
.claude-plugin/   manifiestos del plugin (plugin.json y marketplace.json)
skills/<nombre>/SKILL.md   una carpeta por skill
agents/<nombre>.md         un archivo por agente
templates/        plantillas para empezar
scripts/validate.mjs       validador (también corre en CI)
```

## Añadir una skill
1. Copia `templates/SKILL.template.md` a `skills/<nombre-en-kebab-case>/SKILL.md`.
2. El `name` del frontmatter debe ser igual al nombre de la carpeta.
3. La `description` es lo más importante: Claude decide si cargar la skill leyendo
   **solo esa línea**. Di qué hace y cuándo usarla, con frases reales del usuario
   (en español y en inglés).
4. Usa solo comandos de figma-cli que existan; compruébalos con `figma-cli <comando> --help`.

## Añadir un agente
1. Copia `templates/AGENT.template.md` a `agents/<nombre>.md`.
2. El `name` debe ser igual al nombre del archivo.
3. Limita `tools` a lo que necesita. Un revisor no necesita `Write`.
4. Define con claridad qué devuelve, porque su respuesta la lee otro agente, no una persona.

## Añadir un stack a `figma-to-code`
1. Crea `skills/figma-to-code/stacks/<stack>.md` (por ejemplo `vue.md`, `svelte.md`, `flutter.md`).
   Usa `angular.md` o `lit.md` como modelo.
2. Debe empezar con `# Adaptador: <stack>` y tener una sección `## Detección`
   que diga cómo reconocer el stack en un proyecto.
3. Añade una fila a la tabla de detección en `skills/figma-to-code/SKILL.md`, enlazando `stacks/<stack>.md`.
4. Prioriza las convenciones del proyecto del usuario sobre las tuyas: el adaptador
   explica el stack, pero el proyecto manda.

## Probar en local
Desde la raíz de la repo:
```bash
claude --plugin-dir .
```
Así Claude Code carga las skills y los agentes de tu copia local. Pruébalos con
Figma abierto y el plugin FigCli en marcha.

## Antes del pull request
```bash
npm run validate
```
- Si cambias el comportamiento de una skill o un agente, sube la versión en
  `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` y `package.json`
  (las tres deben coincidir; el validador lo comprueba).
- Describe en el pull request qué probaste en Figma y con qué resultado.

## Reglas que todas las skills respetan
- Nunca borrar nodos ni variables que el usuario ya tenía.
- Crear nodos visuales con `render` / `render-batch`, no con `eval`.
- Usar variables del design system antes que colores fijos.
- Verificar el resultado (`figma-cli verify --measure`) antes de darlo por terminado.
- No mostrar comandos de terminal al usuario.
