# figma-steroids

Esta repo es un plugin de Claude Code: skills en `skills/<nombre>/SKILL.md`,
agentes en `agents/<nombre>.md` y manifiestos en `.claude-plugin/`. Las
convenciones están en CONTRIBUTING.md.

## Al editar esta repo
- Escribe en español; añade frases de activación en inglés en las `description`.
- Comprueba cada comando de figma-cli con `npx figma-cli <comando> --help` antes de documentarlo.
- Ejecuta `npm run validate` después de cualquier cambio en skills, agentes o manifiestos.
- Si cambia el comportamiento, sube la versión en `plugin.json`, `marketplace.json` y `package.json`.

## Al usar Figma desde esta repo
Sigue `skills/figma-connect/SKILL.md` para conectar (modo Safe) y el resto de skills según la tarea.
