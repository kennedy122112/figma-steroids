# figma-steroids

Skills y agentes de **Claude Code** para diseñar en **Figma Desktop** a través de
[figma-cli](https://github.com/silships/figma-cli), conectado por **plugin (modo Safe)**:
sin API key, sin MCP, sin límites de uso y sin modificar la app de Figma.

Es un plugin de Claude Code: quien lo instala obtiene las skills y los agentes en
cualquier proyecto, y cualquiera puede proponer mejoras con un pull request.

## Qué incluye

**Skills** (se activan solas según lo que pidas):

| Skill | Para qué |
|---|---|
| `figma-connect` | Conecta con Figma Desktop por el plugin FigCli |
| `figma-build-ui` | Construye pantallas y componentes con tu design system |
| `figma-design-system` | Importa y exporta tokens; contrato y detección de cambios |
| `figma-a11y-review` | Auditoría de contraste, zonas táctiles, texto y daltonismo |
| `figma-handoff` | Exporta imágenes, tokens, JSX y especificaciones para desarrollo |
| `figma-to-code` | Implementa un frame en tu stack (Angular, React, Lit o cualquier otro) con tus componentes y tokens, y lo compara con el diseño |

`figma-to-code` detecta el stack del proyecto y carga su adaptador de
`skills/figma-to-code/stacks/`. Hoy incluye **Angular + Tailwind**, **React + TypeScript**,
**Lit (TS/JS)** y uno **genérico** para el resto. Añadir un stack nuevo es añadir un archivo.

**Agentes** (subagentes que Claude delega):

| Agente | Rol |
|---|---|
| `figma-ui-builder` | Construye UI y verifica medidas |
| `figma-design-reviewer` | Revisa diseño y accesibilidad, en solo lectura |
| `figma-ds-guardian` | Vigila que el design system no se desincronice |

## Instalación

### 1. Requisitos
- [Figma Desktop](https://www.figma.com/downloads/) abierto.
- [Node.js](https://nodejs.org/) 18 o superior.
- [Claude Code](https://claude.com/claude-code).

### 2. figma-cli
```bash
npm install -g figma-ds-cli
```
O clona esta repo y ejecuta `npm install` (figma-cli viene como dependencia; usa `npx figma-cli`).

### 3. El plugin de Claude Code
Dentro de Claude Code:
```
/plugin marketplace add kennedy122112/figma-steroids
/plugin install figma-steroids@figma-steroids
```

### 4. El plugin de Figma (una sola vez)
En Figma Desktop: **Plugins → Development → Import plugin from manifest…** y elige
`plugin/manifest.json` dentro del paquete figma-cli:

- **Instalación global:** `<carpeta global>/figma-ds-cli/plugin/manifest.json`, donde
  `<carpeta global>` es lo que devuelve `npm root -g`
  (en Windows suele ser `C:\Users\<usuario>\AppData\Roaming\npm\node_modules`).
- **Instalación local (en esta repo):** `node_modules/figma-ds-cli/plugin/manifest.json`.

### 5. Úsalo
Abre **Plugins → Development → FigCli** en Figma, y en Claude Code pide lo que necesites:

> "Conecta con Figma y crea una tarjeta de precios con mis variables."

> "Implementa el frame seleccionado en mi proyecto Angular, usando mis componentes."

> "Revisa la accesibilidad de la pantalla de login."

## Actualizar

Para recibir las versiones nuevas del plugin, dentro de Claude Code:
```
/plugin marketplace update figma-steroids
```

## Cómo funciona

```
Claude Code ──(skills/agentes)──► figma-cli ──► daemon local :3456 ──► plugin FigCli ──► tu archivo de Figma
```

Todo ocurre en tu equipo. El plugin FigCli debe estar abierto mientras trabajas.

## Contribuir

Lee [CONTRIBUTING.md](CONTRIBUTING.md). En resumen:

- **Skill o agente nuevo:** copia una plantilla de `templates/` y escríbelo.
- **Stack nuevo para `figma-to-code`** (Vue, Svelte, Flutter…): añade
  `skills/figma-to-code/stacks/<stack>.md` y enlázalo en la tabla de detección de la skill.

Después ejecuta `npm run validate` y abre un pull request.

## Licencia

MIT. figma-cli es un proyecto independiente de Sil Bormüller, también con licencia MIT.
