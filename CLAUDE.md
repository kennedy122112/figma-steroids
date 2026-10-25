# figma-steroids

Esta repo es un plugin de Claude Code y un instalador para otras herramientas: skills en
`skills/<nombre>/SKILL.md`, agentes en `agents/<nombre>.md`, manifiestos en `.claude-plugin/`
y rutas por herramienta en `platforms.json` (instalador en `lib/` y `bin/`). Las
convenciones están en CONTRIBUTING.md.

## Al editar esta repo
- Escribe en español; añade frases de activación en inglés en las `description`.
- Comprueba cada comando de figma-cli con `npx figma-cli <comando> --help` antes de documentarlo.
- Ejecuta `npm run validate && npm test` después de cualquier cambio.
- Las skills deben funcionar en cualquier agente (Codex, OpenCode, Cursor): nada específico de Claude Code.
- Rutas de una herramienta nueva: solo desde su documentación oficial, enlazada en `docs`.
- Si cambia el comportamiento, sube la versión en `plugin.json`, `marketplace.json` y `package.json`.

## Al usar Figma desde esta repo
Sigue `skills/figma-connect/SKILL.md` para conectar (modo Safe) y el resto de skills según la tarea.
