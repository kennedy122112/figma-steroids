# figma-steroids

<p align="center">
  <a href="README.md">🇪🇸 Español</a> | <a href="README.en.md">🇺🇸 English</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/versión-0.13.0-blue?style=for-the-badge" alt="Versión 0.13.0">
  <img src="https://img.shields.io/badge/skills-8-green?style=for-the-badge" alt="8 skills">
  <img src="https://img.shields.io/badge/agentes-3-purple?style=for-the-badge" alt="3 agentes">
  <img src="https://img.shields.io/badge/stacks-Angular_·_React_·_Lit_·_HTML-orange?style=for-the-badge" alt="Stacks: Angular, React, Lit, HTML">
  <a href="LICENSE"><img src="https://img.shields.io/github/license/kennedy122112/figma-steroids?style=for-the-badge&color=green" alt="Licencia MIT"></a>
</p>

<p align="center">
  <a href="https://github.com/kennedy122112/figma-steroids/stargazers"><img src="https://img.shields.io/github/stars/kennedy122112/figma-steroids?style=flat-square&logo=github" alt="Estrellas en GitHub"></a>
  <a href="https://github.com/kennedy122112/figma-steroids/actions/workflows/validate.yml"><img src="https://img.shields.io/github/actions/workflow/status/kennedy122112/figma-steroids/validate.yml?style=flat-square&label=validate" alt="Estado del validador"></a>
  <img src="https://img.shields.io/badge/funciona_con-Claude_Code_·_Codex_·_OpenCode_·_Cursor-D97757?style=flat-square" alt="Funciona con Claude Code, Codex, OpenCode y Cursor">
  <a href="https://github.com/silships/figma-cli"><img src="https://img.shields.io/badge/powered_by-figma--cli-A259FF?style=flat-square&logo=figma&logoColor=white" alt="Basado en figma-cli"></a>
</p>

<p align="center">
  <img src="assets/banner.svg" alt="figma-steroids: de la idea a Figma, y de Figma a tu código" width="800">
</p>

<p align="center">
  <b>Habla en lenguaje natural. Tu agente de IA diseña en tu Figma y lo implementa en tu stack.</b><br>
  Local, sin API key, sin MCP y sin límites de uso.
</p>

---

## ¿Qué es?

**figma-steroids** le da superpoderes a [figma-cli](https://github.com/silships/figma-cli): un
conjunto de **skills** y **agentes** que saben construir en Figma Desktop, cuidar tu design
system, revisar la accesibilidad y llevar el diseño a código en **Angular, React, Lit o
cualquier otro stack** (también HTML, CSS y JavaScript sin framework).

Funciona con **Claude Code** (como plugin) y con **Codex, OpenCode, Cursor** o cualquier
herramienta compatible con el estándar Agent Skills (con el instalador `figma-steroids init`).

Todo ocurre en tu equipo: el agente controla Figma a través de un plugin local (modo Safe), sin
modificar la app de Figma y sin enviar tu diseño a ningún servicio en la nube.

## ✨ Novedades en v0.13

### De la URL a Figma en un solo comando

```bash
npx -y github:kennedy122112/figma-steroids from-url http://localhost:4200/dashboard --selector "main" --page "Desde código"
```

Abre tu app con Playwright (usa el Edge o Chrome que ya tienes), la lee y la reconstruye en Figma
pieza a pieza. Funciona igual con Angular, React, Lit o HTML. Con `--dry-run` primero ves el
informe sin tocar Figma. El dashboard de prueba se lee en 3 s. Necesita `playwright-core` en
tu proyecto o global (`npm i -g playwright-core`).

Y los **iconos que no son de ninguna librería** (un logo propio, un icono dibujado a mano) ya no
quedan como un hueco: se copia el SVG del código y aparece en Figma como vector editable, con
sus colores reales.

## ✨ Novedades en v0.12

### Iconos: lucide o Material Symbols de Google, también al llevar código a Figma

- **Elige la librería de iconos del proyecto** (lucide o [Material Symbols](https://fonts.google.com/icons))
  y todo el diseño nuevo la usa: `figma-design-system` la detecta en el código y la anota,
  `figma-build-ui` dibuja con ella y `figma-to-code` la traduce al componente correcto
  (`lucide-react`, `lucide-angular`, `<span class="material-symbols-outlined">`, `<mat-icon>`).
- **`figma-from-code` reconoce Material Symbols y `<mat-icon>`** por su nombre, con su estilo
  (outlined, rounded, sharp, relleno), y los coloca como iconos reales en Figma.
- **Y reconoce iconos SVG sin nombre** comparando su forma con los ~2000 iconos de lucide. En el
  dashboard de prueba acertó 17 de 18; los que no reconoce (un logo propio) quedan marcados para
  revisarlos, con las alternativas más parecidas y el texto que tienen cerca.

## ✨ Novedades en v0.10

### Código → Figma: tu app, de vuelta en Figma como diseño editable

Pide *"pasa esta pantalla a Figma"* y `figma-from-code` la reconstruye a partir de **la página
renderizada en el navegador** (con las medidas reales), no de una captura:

| En tu código | En Figma |
|---|---|
| `display: flex`, `gap`, padding | Auto-layout con el mismo espaciado, vinculado a las variables de espaciado |
| `color: var(--color-primary)` | `var:primary`: la variable que usa tu CSS, no un color suelto |
| Texto de 16 px semibold | El estilo de texto del archivo que coincide (`Text/Subtitle`) |
| Tu `<Button>`, `<ui-button>` o `.btn` | Una **instancia** del componente `Button` de Figma |

Funciona igual con React, Angular, Lit (entra en el Shadow DOM) y HTML sin framework, y entrega
un informe de lo que no pudo mapear: colores sin token, iconos sin nombre o valores fuera de la
escala.

Probado de ida y vuelta: la tarjeta de perfil hecha en React volvió a Figma prácticamente
idéntica a la original (1 px de diferencia), sin colores sueltos y con el botón como instancia.
Y con una pantalla real: el dashboard completo de una app de clínica dental (1440×960, ~330
nodos, con tabla, gráfico y menú) se reconstruyó en Figma prácticamente igual al original.

## ✨ Novedades en v0.9

### Figma → código probado en cuatro stacks, y HTML sin framework

`figma-to-code` tiene un adaptador nuevo para **HTML + CSS + JavaScript** sin framework: HTML
semántico, tokens como variables CSS, modificadores de clase (BEM u otro patrón del proyecto),
modo oscuro y Web Components nativos si el proyecto ya los usa.

Además, la misma tarjeta de Figma se implementó en cuatro proyectos de prueba:

| Stack | Componente | Resultado |
|---|---|---|
| **Angular 22 + Tailwind 4** | `<app-profile-card>` | ✅ |
| **React 19 + Vite 8 + Tailwind 4** | `<ProfileCard>` | ✅ |
| **Lit 3 + TypeScript** | `<ui-profile-card>` | ✅ Los tokens atraviesan el Shadow DOM |
| **HTML + CSS + JavaScript** | `.profile-card` (BEM) | ✅ |

En todos, el resultado coincide con Figma con **menos de 1 px** de diferencia, se reutiliza el
botón que ya tenía el proyecto (extendido de forma compatible) y el **modo oscuro** funciona
solo cambiando los tokens, sin tocar los componentes.

## ✨ Novedades en v0.8

### Modo claro / oscuro, de Figma al código

Pide *"añade modo oscuro"* y `figma-design-system`:

1. **Crea el tema oscuro** con los mismos nombres de variable. Si tu plan de Figma admite
   modos, como modo `Dark`; en el plan gratuito, que solo permite un modo por colección, como
   una colección paralela `… · Dark`.
2. **Lo previsualiza** en una copia de tu diseño, al lado del original, sin tocarlo.
3. **Revisa el contraste** del tema oscuro.
4. **Lo lleva al código** como bloques `:root` / `.dark`, listos para Tailwind v4 o CSS.

Probado en Figma (plan gratuito) y en un proyecto Angular 22 + Tailwind 4: la app entera
cambia de tema con la clase `dark`, sin tocar los componentes.

## ✨ Novedades en v0.7

### Plugin de Figma propio: ve lo que hace la IA y deténla cuando quieras

El plugin FigCli de figma-cli ejecuta en tu archivo todo lo que manda la IA sin mostrar nada.
El plugin **figma-steroids** hace lo mismo y además te enseña qué pasa:

| | Qué ves |
|---|---|
| **Archivo conectado** | En qué archivo y página está trabajando la IA |
| **Selección con ID** | Lo que seleccionas, con su ID y un botón para copiarlo ("revisa el 2:2") |
| **Registro de actividad** | Cada comando de la IA: **lectura** (gris), **+creados ~modificados −borrados** (azul) o **error** (rojo, con el código que falló) |
| **Ver en el lienzo** | Un botón **Ver** en cada entrada que cambió algo: selecciona y enfoca lo que hizo la IA, aunque esté en otra página |
| **Registro guardado** | Se conserva por archivo al cerrar el plugin ("De sesiones anteriores"), hasta 100 entradas, solo en tu equipo |
| **Copiar registro** | Todo el registro como texto, para pegárselo a la IA o adjuntarlo a un reporte |
| **Pausa** | Un botón que bloquea al instante los comandos de la IA, que recibe un mensaje claro de que la detuviste |

```bash
npx -y github:kennedy122112/figma-steroids plugin
```

Ese comando copia el plugin a `~/.figma-steroids/figma-plugin` y te da la ruta del
`manifest.json` para importarlo en Figma (**Plugins → Development → Import plugin from
manifest…**). Úsalo **en lugar de** FigCli, no junto a él.

Probado en Figma Desktop: conexión, selección, registro con lecturas, creaciones,
modificaciones, borrados y errores, Ver en el lienzo, registro guardado al reabrir, copiar
y pausa.

Figma no distingue tus ediciones de las de la IA, así que el registro solo cuenta los
cambios que llegan en los 3 segundos siguientes a cada comando: si en ese momento editas
algo a mano, puede sumarse a la entrada de la IA.

## ✨ Novedades en v0.6

### Un design system completo, no solo colores

`figma-design-system` ahora completa el sistema a partir de lo que tu archivo ya usa:

- **Escala de espaciado** (`spacing/1` = 4 px … ) y gaps y paddings vinculados a ella.
- **Escala tipográfica** como estilos de texto (`Text/Title`, `Text/Body`, `Text/Caption`…).
- **Componente `Button`** con variantes, tamaños y estados (`hover`, `focus`, `disabled`),
  listo para usar con `<Instance component="Button" …>`.

`figma-build-ui` los usa automáticamente cuando existen, así cada pantalla nueva deja de
inventar tamaños y botones.

## ✨ Novedades en v0.4

### También como plugin de Codex y Cursor

| Herramienta | Plugin | Incluye |
|---|---|---|
| **Claude Code** | `/plugin install figma-steroids@figma-steroids` | skills + agentes |
| **Codex** | `codex plugin add figma-steroids@figma-steroids` | skills |
| **Cursor** | manifiesto listo en `.cursor-plugin/` (pendiente de publicar en su Marketplace) | skills + agentes |
| **OpenCode** | sus plugins son código JS, no paquetes de skills: usa el instalador | — |

Los manifiestos siguen los esquemas oficiales: [Agent Plugins](https://agent-plugins.org)
(`plugin.json` en la raíz), [Codex](https://developers.openai.com/codex/plugins/build/)
(`.agents/plugins/marketplace.json`) y [Cursor](https://cursor.com/docs/reference/plugins)
(`.cursor-plugin/plugin.json`). Todos apuntan a las mismas carpetas `skills/` y `agents/`.

## ✨ Novedades en v0.3

### Un instalador para todos tus agentes

Las mismas skills y agentes, en el formato de cada herramienta:

```bash
npx -y github:kennedy122112/figma-steroids init --ai codex
npx -y github:kennedy122112/figma-steroids init --ai opencode,cursor
npx -y github:kennedy122112/figma-steroids init --ai all --global
```

| Herramienta | Skills | Agentes | Instrucciones |
|---|---|---|---|
| **Claude Code** | `.claude/skills/` | `.claude/agents/*.md` | (usa el plugin o estas carpetas) |
| **Codex** | `.agents/skills/` | `.codex/agents/*.toml` | `AGENTS.md` |
| **OpenCode** | `.opencode/skills/` | `.opencode/agents/*.md` (subagentes) | `AGENTS.md` |
| **Cursor** | `.cursor/skills/` | `.cursor/agents/*.md` | `AGENTS.md` |
| **Universal** | `.agents/skills/` | como roles dentro de `AGENTS.md` | `AGENTS.md` |

Con `--global` se instala en la carpeta del usuario (`~/.claude`, `~/.agents`, `~/.codex`,
`~/.config/opencode`, `~/.cursor`) y queda disponible en todos tus proyectos. Las rutas están
verificadas en la documentación oficial de cada herramienta y viven en
[`platforms.json`](platforms.json).

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
| `figma-setup` | Primer arranque: comprueba Node.js, figma-cli, Figma y el plugin, e instala lo que falte (con tu permiso) |
| `figma-connect` | Conecta con Figma Desktop por el plugin FigCli (modo Safe) |
| `figma-build-ui` | Construye pantallas y componentes con tus variables, reutilizando tus componentes |
| `figma-design-system` | Importa y exporta tokens (Tailwind, CSS, DTCG, DESIGN.md); crea escala de espaciado, estilos de texto, un `Button` con variantes y estados, y modo claro / oscuro; detecta cambios con snapshot/check |
| `figma-a11y-review` | Auditoría de contraste WCAG, zonas táctiles, tamaño de texto y daltonismo |
| `figma-handoff` | Exporta PNG/SVG/PDF, tokens, JSX, historias de Storybook y especificaciones |
| `figma-to-code` | Implementa un frame en tu stack y lo compara con el diseño |
| `figma-from-code` | Reconstruye en Figma una pantalla que ya existe en tu código, con auto-layout, tus variables, estilos de texto y componentes |

### 🤖 Agentes (tu herramienta les delega trabajo)

En herramientas sin subagentes se instalan como roles dentro de `AGENTS.md`.

| Agente | Rol | Edita |
|---|---|---|
| `figma-ui-builder` | Construye UI en Figma y verifica las medidas | Sí |
| `figma-design-reviewer` | Revisa jerarquía, consistencia, tokens, estados y accesibilidad | No (solo lectura) |
| `figma-ds-guardian` | Vigila que Figma y el código no se desincronicen | Solo con confirmación |

### 🛠️ Stacks soportados por `figma-to-code`

| Stack | Adaptador | Estado |
|---|---|---|
| **Angular + TypeScript + Tailwind** | [`stacks/angular.md`](skills/figma-to-code/stacks/angular.md) | ✅ Probado (Angular 22 + Tailwind 4) |
| **React + TypeScript** (Vite, Next.js…) | [`stacks/react.md`](skills/figma-to-code/stacks/react.md) | ✅ Probado (React 19 + Vite 8 + Tailwind 4) |
| **Lit** (TypeScript o JavaScript) | [`stacks/lit.md`](skills/figma-to-code/stacks/lit.md) | ✅ Probado (Lit 3 + TypeScript) |
| **HTML + CSS + JavaScript** (sin framework) | [`stacks/html.md`](skills/figma-to-code/stacks/html.md) | ✅ Probado (CSS con BEM y variables) |
| **Cualquier otro** (Vue, Svelte, Flutter, SwiftUI…) | [`stacks/generic.md`](skills/figma-to-code/stacks/generic.md) | ✅ Genérico · 🙌 [aporta el tuyo](#-arquitectura-y-contribución) |

En todos los casos **las convenciones de tu proyecto mandan**: antes de escribir, el agente
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

## ¿Dónde funciona?

figma-cli habla con Figma Desktop **a través de tu propia computadora**, así que el agente
tiene que estar en tu máquina y poder ejecutar comandos. Tú no escribes ninguno: los ejecuta
la IA, y la skill `figma-setup` instala lo que falte con tu permiso.

| App | ¿Funciona? | Por qué |
|---|---|---|
| **Claude Desktop, pestaña Code** | ✅ | Es Claude Code con interfaz gráfica; el plugin se instala igual |
| **Claude Code** en la terminal o en VS Code / JetBrains | ✅ | Trabaja en tu equipo |
| **Codex** (terminal o app de escritorio) | ✅ | Trabaja en tu equipo; plugin o instalador |
| **Cursor** | ✅ | Su agente ejecuta comandos en tu equipo |
| **OpenCode** | ✅ | Trabaja en tu equipo; usa el instalador |
| **Claude Desktop o claude.ai, chat normal** | ❌ | El chat no ejecuta comandos en tu computadora: usa el conector MCP de Figma |
| **Versiones en la nube** (Claude Code en la web, tareas de Codex en la nube) | ❌ | Corren en servidores remotos que no ven tu Figma Desktop |

**Regla rápida:** si la app trabaja en una carpeta de tu computadora y puede ejecutar comandos,
funciona. Si es un chat o corre en la nube, no.

## Probado en

Pruebas reales contra Figma Desktop (Windows 11, figma-cli 2.2.5, plugin FigCli en modo Safe),
octubre de 2026. Cada prueba encontró detalles que ya están corregidos en las skills.

| Herramienta | Instalación | Qué se probó | Resultado |
|---|---|---|---|
| **Claude Code** (Claude Desktop, pestaña Code) | Instalador `--ai claude --global` | Activación automática de las skills, `figma-setup`, construir una tarjeta con variables, subagente revisor, `figma-to-code` en Angular | ✅ |
| **OpenCode** (Desktop) | Instalador `--ai opencode --global` | Lo mismo, más una edición acotada de un diseño existente | ✅ |
| **Codex** (CLI 0.164) | `codex plugin marketplace add` + `codex plugin add` | Instalación del plugin desde GitHub con sus 7 skills | ✅ instalación · ⏳ sin probar en sesión |
| **Cursor** | — | Manifiesto `.cursor-plugin/` preparado | ⏳ sin probar |

**`figma-to-code`** se probó en cuatro stacks: Angular 22 + Tailwind 4, React 19 + Vite 8 +
Tailwind 4, Lit 3 + TypeScript y HTML + CSS + JavaScript sin framework. En todos compila (o
no lo necesita), el resultado coincide con Figma con menos de 1 px de diferencia y el modo
oscuro funciona cambiando solo los tokens. En Lit, los tokens atraviesan el Shadow DOM.

¿Lo probaste en otra herramienta o stack? Abre un issue o un pull request con lo que viste.

## Requisitos

- [Figma Desktop](https://www.figma.com/downloads/), abierto.
- [Node.js](https://nodejs.org/) 18.17 o superior.
- Un agente de IA: [Claude Code](https://claude.com/claude-code), Codex, OpenCode, Cursor u
  otro compatible con Agent Skills.

## Instalación

### 1. figma-cli

```bash
npm install -g figma-ds-cli
```

Si no quieres instalarlo, las skills usan `npx -p figma-ds-cli figma-cli` como alternativa.

### 2. Las skills y agentes

**Claude Code: como plugin (recomendado).** Dentro de Claude Code:

```
/plugin marketplace add kennedy122112/figma-steroids
/plugin install figma-steroids@figma-steroids
```

**Codex: como plugin.** En una terminal:

```bash
codex plugin marketplace add kennedy122112/figma-steroids
codex plugin add figma-steroids@figma-steroids
```

El plugin de Codex trae las skills; los plugins de Codex no incluyen agentes. Si también
quieres los agentes, usa el instalador con `--ai codex`.

**Cursor: como plugin.** La repo incluye el manifiesto `.cursor-plugin/plugin.json` (skills y
agentes). Para aparecer en el Marketplace de Cursor hay que enviarlo a revisión; mientras no
esté publicado, usa el instalador con `--ai cursor`.

**OpenCode, Cursor, Codex u otros: con el instalador.** Desde la carpeta de tu proyecto:

```bash
npx -y github:kennedy122112/figma-steroids init --ai codex
```

| Opción | Qué hace |
|---|---|
| `--ai codex,cursor` | Varias herramientas a la vez (`claude`, `codex`, `opencode`, `cursor`, `universal` o `all`) |
| `--global` | Instala en tu carpeta de usuario, para todos los proyectos |
| `--dry-run` | Muestra qué haría, sin escribir nada |
| `--force` | Sobrescribe skills o agentes tuyos que tengan el mismo nombre |

Otros comandos: `list` (rutas de cada herramienta), `update` (reinstala la última versión en las
herramientas ya instaladas) y `uninstall`. El instalador nunca toca tus propias skills ni el
resto de tu `AGENTS.md`: solo gestiona su bloque `<!-- figma-steroids -->` y deja un registro
en `.figma-steroids.json`.

### 3. El plugin de Figma (una sola vez)

En Figma Desktop: **Plugins → Development → Import plugin from manifest…** y elige
`plugin/manifest.json` dentro del paquete figma-cli:

- **Instalación global:** `<carpeta global>/figma-ds-cli/plugin/manifest.json`, donde
  `<carpeta global>` es lo que devuelve `npm root -g`
  (en Windows suele ser `C:\Users\<usuario>\AppData\Roaming\npm\node_modules`).
- **Instalación local (en esta repo):** `node_modules/figma-ds-cli/plugin/manifest.json`.

**O, mejor, nuestro plugin figma-steroids** (registro de actividad y pausa):
`npx -y github:kennedy122112/figma-steroids plugin` te da la ruta de su `manifest.json`.
Ábrelo con **Plugins → Development → figma-steroids**. Usa uno de los dos, no ambos.

### Actualizar

```
/plugin marketplace update figma-steroids
```

Con el instalador (añade `--global` si instalaste así):

```bash
npx -y github:kennedy122112/figma-steroids update
```

## Uso

### Primera vez

Con Figma Desktop abierto, dile a tu agente:

> "Configura figma-steroids y conéctalo a mi Figma."

La skill `figma-setup` revisa Node.js, figma-cli, Figma y el plugin FigCli, te pide permiso
antes de instalar algo y te da la ruta exacta del plugin para importarlo en Figma.

### Modo skill (automático)

Abre **Plugins → Development → FigCli** en Figma y habla con tu agente con normalidad. La skill
adecuada se activa sola:

```
Conecta con Figma y crea una tarjeta de precios con mis variables

Construye una pantalla de login con mi design system

Revisa la accesibilidad de la pantalla seleccionada

Importa mi tailwind.config.js como variables de Figma

Implementa el frame seleccionado en mi proyecto Angular
```

### Implementar un diseño en un proyecto existente

Abre tu agente en el proyecto, selecciona el frame en Figma y usa un prompt como este:

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
.claude-plugin/              plugin de Claude Code (plugin.json, marketplace.json)
plugin.json                  plugin portable Agent Plugins (Codex, Cursor)
.agents/plugins/             marketplace de Codex
.cursor-plugin/              plugin de Cursor
skills/<nombre>/SKILL.md     una carpeta por skill
skills/figma-to-code/stacks/ un adaptador por stack
agents/<nombre>.md           un archivo por agente
platforms.json               dónde instalar en cada herramienta (Codex, OpenCode, Cursor…)
lib/installer.mjs            instalador y conversores de formato de agentes
bin/figma-steroids.mjs       CLI: init, update, uninstall, list
figma-plugin/                plugin de Figma (registro de actividad, pausa, selección con ID)
templates/                   plantillas para skills y agentes nuevos
scripts/validate.mjs         validador (también corre en CI)
tests/                       pruebas del instalador (Windows, macOS y Linux en CI)
```

Cualquiera puede mejorarlo; las skills y agentes son archivos Markdown con instrucciones:

```bash
# 1. Haz un fork y clónalo
git clone https://github.com/<tu-usuario>/figma-steroids.git
cd figma-steroids && npm install

# 2. Añade o mejora algo
#    - skill:  copia templates/SKILL.template.md a skills/<nombre>/SKILL.md
#    - agente: copia templates/AGENT.template.md a agents/<nombre>.md
#    - stack:  crea skills/figma-to-code/stacks/<stack>.md y enlázalo en la skill
#    - herramienta: añade una entrada a platforms.json (con el enlace a su documentación)

# 3. Pruébalo en local con Figma abierto
claude --plugin-dir .                                         # Claude Code
node bin/figma-steroids.mjs init --ai codex --dry-run         # otras herramientas

# 4. Valida, prueba y abre un pull request
npm run validate && npm test
```

Los detalles están en [CONTRIBUTING.md](CONTRIBUTING.md). Los cambios de cada versión, en
[CHANGELOG.md](CHANGELOG.md).

## Solución de problemas

### "Plugin not detected"
El plugin FigCli no está abierto en Figma o se cerró. Ábrelo en **Plugins → Development → FigCli**
y déjalo abierto mientras trabajas.

### El daemon no está corriendo
Pídele a tu agente que vuelva a conectar, o ejecuta:

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
No instales figma-cli: las skills usan `npx -p figma-ds-cli figma-cli`.

### Las skills no aparecen en Claude Code
Comprueba que el plugin está instalado con `/plugin`, y actualízalo con
`/plugin marketplace update figma-steroids`.

### Las skills no aparecen en Codex, OpenCode o Cursor
Comprueba dónde las instaló el instalador con `npx -y github:kennedy122112/figma-steroids list`
y reinicia la herramienta. Si instalaste con `--global`, revisa tu carpeta de usuario; si no, la
raíz del proyecto donde ejecutaste `init`.

### "omitida (ya existe y no es de figma-steroids)"
Tienes una skill o un agente propio con el mismo nombre. El instalador no lo toca; usa
`--force` solo si quieres reemplazarlo.

---

## Créditos

Construido sobre [figma-cli](https://github.com/silships/figma-cli) de Sil Bormüller
([Into Design Systems](https://intodesignsystems.com)), proyecto independiente con licencia MIT.
El plugin de Figma de `figma-plugin/` parte del plugin FigCli de figma-cli: mantiene su
protocolo con el daemon y añade la interfaz.

## Licencia

Este proyecto está bajo la [licencia MIT](LICENSE).
