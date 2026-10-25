---
name: figma-design-system
description: Gestiona el design system en Figma con figma-cli. Importa tokens desde DESIGN.md, Tailwind, CSS o tokens.json como variables reales, exporta el sistema del archivo a DESIGN.md o DTCG, y lo congela con snapshot / rules / check para detectar cambios. Úsala cuando el usuario diga "importa mis colores", "carga el design system", "exporta los tokens", "documenta el sistema", "¿cambió algo?", o quiera validar el sistema en CI.
---

# Design system en Figma

Requisito: conexión activa (skill `figma-connect`).

## Importar (código → Figma)
`figma-cli import <fuente>`, donde la fuente puede ser:
- `DESIGN.md`
- `tailwind.config.js`
- `globals.css` / `styles.css` (incluye HSL de shadcn, `@theme` de Tailwind v4 y oklch)
- `tokens.json` (W3C / Style Dictionary / Tokens Studio, con alias)
- `http://localhost:6006` (Storybook: solo trae el inventario de componentes, no tokens)

Después muéstralo en el lienzo con `figma-cli var visualize`, si el usuario quiere verlo.

## Exportar (Figma → código)
- Todo el sistema: `figma-cli extract` (genera `DESIGN.md`).
- Solo tokens: `figma-cli extract --sections tokens`.
- Formatos: `figma-cli export dtcg tokens.json` · `figma-cli export css` · `figma-cli export tailwind`.
- Si los colores salen blancos porque vienen de una librería compartida: `figma-cli extract --resolve-remote`.

## Contrato y detección de cambios (sin IA)
1. `figma-cli snapshot` genera `design.json`. Hazle commit.
2. `figma-cli rules gen` genera `rules/*.yaml`, un contrato por componente. Revísalos como un diff.
3. `figma-cli check` compara el archivo con los contratos y sale con 1 si encuentra cambios. Para CI usa `--json`.
4. `figma-cli check --roundtrip` comprueba que los tokens sobreviven a una exportación y reimportación.

Un rojo en `check` significa que **algo cambió**, no necesariamente que esté mal.
Si el cambio era intencional, vuelve a ejecutar `snapshot` y revisa el diff con el usuario.

## Reglas
- Nunca sobrescribas ni borres variables existentes sin confirmación del usuario.
- Respeta los nombres de colecciones y modos (light/dark) que ya existen.
