# figma-steroids

<p align="center">
  <img src="https://img.shields.io/badge/versión-0.2.1-blue?style=for-the-badge" alt="Versión 0.2.1">
  <img src="https://img.shields.io/badge/skills-6-green?style=for-the-badge" alt="6 skills">
  <img src="https://img.shields.io/badge/agentes-3-purple?style=for-the-badge" alt="3 agentes">
  <img src="https://img.shields.io/badge/stacks-Angular_·_React_·_Lit-orange?style=for-the-badge" alt="Stacks: Angular, React, Lit">
  <a href="LICENSE"><img src="https://img.shields.io/github/license/kennedy122112/figma-steroids?style=for-the-badge&color=green" alt="Licencia MIT"></a>
</p>

<p align="center">
  <a href="https://github.com/kennedy122112/figma-steroids/stargazers"><img src="https://img.shields.io/github/stars/kennedy122112/figma-steroids?style=flat-square&logo=github" alt="Estrellas en GitHub"></a>
  <a href="https://github.com/kennedy122112/figma-steroids/actions/workflows/validate.yml"><img src="https://img.shields.io/github/actions/workflow/status/kennedy122112/figma-steroids/validate.yml?style=flat-square&label=validate" alt="Estado del validador"></a>
  <img src="https://img.shields.io/badge/Claude_Code-plugin-D97757?style=flat-square" alt="Plugin de Claude Code">
  <a href="https://github.com/silships/figma-cli"><img src="https://img.shields.io/badge/powered_by-figma--cli-A259FF?style=flat-square&logo=figma&logoColor=white" alt="Basado en figma-cli"></a>
</p>

<p align="center">
  <img src="assets/banner.svg" alt="figma-steroids: de la idea a Figma, y de Figma a tu código" width="800">
</p>

<p align="center">
  <b>Habla en lenguaje natural. Claude diseña en tu Figma y lo implementa en tu stack.</b><br>
  Local, sin API key, sin MCP y sin límites de uso.
</p>

---

## ¿Qué es?

**figma-steroids** es un plugin de [Claude Code](https://claude.com/claude-code) que le da
superpoderes a [figma-cli](https://github.com/silships/figma-cli): un conjunto de **skills** y
**agentes** que saben construir en Figma Desktop, cuidar tu design system, revisar la
accesibilidad y llevar el diseño a código en **Angular, React, Lit o cualquier otro stack**.

Todo ocurre en tu equipo: Claude controla Figma a través de un plugin local (modo Safe), sin
modificar la app de Figma y sin enviar tu diseño a ningún servicio en la nube.

## ✨ Novedades en v0.2

### Figma → código, en cualquier stack

La skill `figma-to-code` detecta el stack de tu proyecto, carga el adaptador que le
corresponde y escribe el componente **como lo escribiría tu equipo**: con tus componentes,
tus tokens y tus convenciones. Después compara el resultado con la captura de Figma.

Ejemplo del resumen que entrega al terminar (ilustrativo):

```
+--------------------------------------------------------------------------------+
|  FRAME: "Pricing Card"  →  ANGULAR 18 + TAILWIND 4 + TYPESCRIPT                |
+--------------------------------------------------------------------------------+
|                                                                                |
|  ADAPTADOR: stacks/angular.md                                                  |
|     Standalone · OnPush · input()/output() · prefijo del proyecto: app-        |
|                                                                                |
|  TOKENS MAPEADOS:                                                              |
|     var:primary          →  bg-primary                                         |
|     var:card             →  bg-card                                            |
|     var:muted-foreground →  text-muted-foreground                              |
|     var:radius-lg        →  rounded-lg                                         |
|     Falta: var:success   →  propuesto en @theme (pendiente de aprobar)         |
|                                                                                |
|  COMPONENTES REUTILIZADOS:                                                     |
|     <app-button> (variant, size)  ·  <app-badge>                               |
|                                                                                |
|  ARCHIVOS:                                                                     |
|     + src/app/pricing/pricing-card.component.ts                                |
|     + src/app/pricing/pricing-card.component.html                              |
|     + src/app/pricing/pricing-card.component.spec.ts                           |
|                                                                                |
|  QA VISUAL (Figma vs navegador, 1440px):                                       |
|     [x] Espaciado y tamaños de texto                                           |
|     [x] Colores desde tokens (sin hex sueltos)                                 |
|     [x] Estados hover / focus-visible / disabled                               |
|     [ ] Sombra: el proyecto no tiene token equivalente (anotado)               |
|                                                                                |
+--------------------------------------------------------------------------------+
```

### Cómo funciona

```
┌───────────────┐   ┌──────────────────┐   ┌───────────┐   ┌──────────────┐   ┌───────────────┐
│   Tú (chat)   │──►│ Skills y agentes │──►│ figma-cli │──►│ daemon local │──►│ plugin FigCli │
│ crea, revisa, │   │  figma-steroids  │   │           │   │    :3456     │   │   en Figma    │
│  implementa   │   └────────┬─────────┘   └───────────┘   └──────────────┘   └───────────────┘
└───────────────┘            │
                             ▼
                    ┌──────────────────┐
                    │   Tu proyecto    │  Angular · React · Lit · …
                    │  (figma-to-code) │  componentes, tokens, tests
                    └──────────────────┘
```

## Características

### 🧩 Skills (se activan solas según lo que pidas)

| Skill | Qué hace |
|---|---|
| `figma-connect` | Conecta con Figma Desktop por el plugin FigCli (modo Safe) |
| `figma-build-ui` | Construye pantallas y componentes con tus variables, reutilizando tus componentes |
| `figma-design-system` | Importa y exporta tokens (Tailwind, CSS, DTCG, DESIGN.md) y detecta cambios con snapshot/check |
| `figma-a11y-review` | Auditoría de contraste WCAG, zonas táctiles, tamaño de texto y daltonismo |
| `figma-handoff` | Exporta PNG/SVG/PDF, tokens, JSX, historias de Storybook y especificaciones |
| `figma-to-code` | Implementa un frame en tu stack y lo compara con el diseño |

### 🤖 Agentes (Claude les delega trabajo)

| Agente | Rol | Edita |
|---|---|---|
| `figma-ui-builder` | Construye UI en Figma y verifica las medidas | Sí |
| `figma-design-reviewer` | Revisa jerarquía, consistencia, tokens, estados y accesibilidad | No (solo lectura) |
| `figma-ds-guardian` | Vigila que Figma y el código no se desincronicen | Solo con confirmación |

### 🛠️ Stacks soportados por `figma-to-code`

| Stack | Adaptador | Estado |
|---|---|---|
| **Angular + TypeScript + Tailwind** | [`stacks/angular.md`](skills/figma-to-code/stacks/angular.md) | ✅ Incluido |
| **React + TypeScript** (Vite, Next.js…) | [`stacks/react.md`](skills/figma-to-code/stacks/react.md) | ✅ Incluido |
| **Lit** (TypeScript o JavaScript) | [`stacks/lit.md`](skills/figma-to-code/stacks/lit.md) | ✅ Incluido |
| **Cualquier otro** (Vue, Svelte, Flutter, SwiftUI…) | [`stacks/generic.md`](skills/figma-to-code/stacks/generic.md) | ✅ Genérico · 🙌 [aporta el tuyo](#-arquitectura-y-contribución) |

En todos los casos **las convenciones de tu proyecto mandan**: antes de escribir, Claude
revisa tus componentes existentes y copia su estilo.

### ⚖️ figma-steroids vs MCP de Figma

| | figma-steroids (figma-cli) | MCP oficial de Figma |
|---|---|---|
| Conexión | Local, plugin FigCli en Figma Desktop | API REST en la nube |
| Token de Figma | No hace falta | Obligatorio |
| Límites de uso | Ninguno | Por asiento |
| Funciona sin conexión | Sí | No |
| Archivos cerrados o por URL | No, solo el archivo abierto | Sí |
| Code Connect | No | Sí |

No son excluyentes: puedes usar figma-steroids para construir y el MCP para leer archivos que no tienes abiertos.

## Requisitos

- [Figma Desktop](https://www.figma.com/downloads/), abierto.
- [Node.js](https://nodejs.org/) 18 o superior.
- [Claude Code](https://claude.com/claude-code).

## Instalación

### 1. figma-cli

```bash
npm install -g figma-ds-cli
```

O clona esta repo y ejecuta `npm install`: figma-cli viene como dependencia (úsalo con `npx figma-cli`).

### 2. El plugin de Claude Code (recomendado)

Dentro de Claude Code:

```
/plugin marketplace add kennedy122112/figma-steroids
/plugin install figma-steroids@figma-steroids
```

### 3. El plugin de Figma (una sola vez)

En Figma Desktop: **Plugins → Development → Import plugin from manifest…** y elige
`plugin/manifest.json` dentro del paquete figma-cli:

- **Instalación global:** `<carpeta global>/figma-ds-cli/plugin/manifest.json`, donde
  `<carpeta global>` es lo que devuelve `npm root -g`
  (en Windows suele ser `C:\Users\<usuario>\AppData\Roaming\npm\node_modules`).
- **Instalación local (en esta repo):** `node_modules/figma-ds-cli/plugin/manifest.json`.

### Actualizar

```
/plugin marketplace update figma-steroids
```

## Uso

### Modo skill (automático)

Abre **Plugins → Development → FigCli** en Figma y habla con Claude con normalidad. La skill
adecuada se activa sola:

```
Conecta con Figma y crea una tarjeta de precios con mis variables

Construye una pantalla de login con mi design system

Revisa la accesibilidad de la pantalla seleccionada

Importa mi tailwind.config.js como variables de Figma

Implementa el frame seleccionado en mi proyecto Angular
```

### Implementar un diseño en un proyecto existente

Abre Claude Code en tu proyecto, selecciona el frame en Figma y usa un prompt como este:

```text
Usa figma-to-code para implementar el frame seleccionado en este proyecto.
Primero detecta el stack, la librería de componentes y dónde viven los tokens.
Reutiliza los componentes que ya existen y respeta las convenciones del proyecto.
Mapea cada variable de Figma a un token existente; si falta alguno, propónmelo
en lugar de usar el valor en hex. Incluye estados hover, focus y disabled, y
atributos de accesibilidad. Al terminar, compara con la captura de Figma y
resume los archivos cambiados y las diferencias que queden.
```

**Checklist de una buena implementación:**

- **Detectar:** stack, versión, sistema de estilos y librería de componentes.
- **Reutilizar:** componentes existentes antes que nuevos.
- **Mapear:** cada color, espaciado y radio, a un token; nunca un valor suelto.
- **Completar:** estados interactivos, `aria-*` y navegación por teclado.
- **Verificar:** build, lint, tests y comparación visual con Figma.

## 🏗️ Arquitectura y contribución

```
.claude-plugin/              manifiestos del plugin (plugin.json, marketplace.json)
skills/<nombre>/SKILL.md     una carpeta por skill
skills/figma-to-code/stacks/ un adaptador por stack
agents/<nombre>.md           un archivo por agente
templates/                   plantillas para skills y agentes nuevos
scripts/validate.mjs         validador (también corre en CI)
```

Cualquiera puede mejorar el plugin; son archivos Markdown con instrucciones para Claude:

```bash
# 1. Haz un fork y clónalo
git clone https://github.com/<tu-usuario>/figma-steroids.git
cd figma-steroids && npm install

# 2. Añade o mejora algo
#    - skill:  copia templates/SKILL.template.md a skills/<nombre>/SKILL.md
#    - agente: copia templates/AGENT.template.md a agents/<nombre>.md
#    - stack:  crea skills/figma-to-code/stacks/<stack>.md y enlázalo en la skill

# 3. Pruébalo en local con Figma abierto
claude --plugin-dir .

# 4. Valida y abre un pull request
npm run validate
```

Los detalles están en [CONTRIBUTING.md](CONTRIBUTING.md).

## Solución de problemas

### "Plugin not detected"
El plugin FigCli no está abierto en Figma o se cerró. Ábrelo en **Plugins → Development → FigCli**
y déjalo abierto mientras trabajas.

### El daemon no está corriendo
Pídele a Claude que vuelva a conectar, o ejecuta:

```bash
figma-cli daemon restart
```

### Los comandos van al archivo equivocado
Con varios archivos abiertos, fija el destino con una parte de su nombre:

```bash
FIGMA_FILE="Mi archivo" figma-cli canvas info
```

### No encuentro el `manifest.json` del plugin
Ejecuta `npm root -g` y busca `figma-ds-cli/plugin/manifest.json` dentro de esa carpeta.
Si instalaste en local, está en `node_modules/figma-ds-cli/plugin/`.

### `npm install -g` falla por permisos
Usa la instalación local de esta repo y llama a la herramienta con `npx figma-cli`.

### Las skills no aparecen en Claude Code
Comprueba que el plugin está instalado con `/plugin`, y actualízalo con
`/plugin marketplace update figma-steroids`.

---

## Créditos

Construido sobre [figma-cli](https://github.com/silships/figma-cli) de Sil Bormüller
([Into Design Systems](https://intodesignsystems.com)), proyecto independiente con licencia MIT.

## Licencia

Este proyecto está bajo la [licencia MIT](LICENSE).
