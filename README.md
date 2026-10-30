# figma-steroids

<p align="center">
  <a href="README.md">🇪🇸 Español</a> | <a href="README.en.md">🇺🇸 English</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/versión-0.18.0-blue?style=for-the-badge" alt="Versión 0.18.0">
  <img src="https://img.shields.io/badge/funciona_con-Claude_Code_·_Codex_·_OpenCode_·_Antigravity-D97757?style=for-the-badge" alt="Funciona con Claude Code, Codex, OpenCode y Antigravity">
  <a href="LICENSE"><img src="https://img.shields.io/github/license/kennedy122112/figma-steroids?style=for-the-badge&color=green" alt="Licencia MIT"></a>
</p>

<p align="center">
  <img src="assets/banner.svg" alt="figma-steroids: de la idea a Figma, y de Figma a tu código" width="800">
</p>

<p align="center">
  <b>Tu IA diseña en Figma y lo pasa a tu código. Y al revés.</b><br>
  Local, sin MCP, sin API key y sin límites de uso.
</p>

---

## ¿Qué es?

Un conjunto de **skills** y **agentes** para tu asistente de IA (Claude Code, Codex, OpenCode…)
que le enseñan a trabajar en **Figma Desktop**: diseñar con tu design system, pasar un diseño a
código en tu stack y llevar a Figma una pantalla que ya existe en tu app.

Está construido sobre [figma-cli](https://github.com/silships/figma-cli), de Sil Bormüller.

## Cómo funciona

```
 Tú, en el chat ──► tu IA + skills de figma-steroids ──► figma-cli ──► plugin en Figma Desktop
 "diseña un login"                                       (en tu equipo)   (aplica los cambios)
```

1. Le pides algo a tu IA en lenguaje normal.
2. La skill adecuada se activa sola y le dice a la IA cómo hacerlo bien (usar tus variables, tus
   componentes, verificar medidas…).
3. La IA ejecuta comandos de **figma-cli** en tu computadora, y el **plugin** que tienes abierto
   en Figma los aplica en tu archivo.

**Sin MCP:** no pasa por la nube, no necesitas token de Figma y tu diseño no sale de tu equipo.
El plugin te muestra en vivo lo que hace la IA y tiene un botón para **pausarla**.

### Qué puedes pedirle

| Pides | Pasa |
|---|---|
| *"Crea una pantalla de login con mi design system"* | La construye en Figma con tus colores, textos y componentes, editable |
| *"Implementa el frame seleccionado en mi proyecto"* | Escribe el componente en tu stack (Angular, React, Lit, HTML…) reutilizando lo que ya tienes |
| *"Pasa esta pantalla de mi app a Figma"* | Lee tu app en el navegador y la reconstruye en Figma con auto-layout y tus variables |
| *"Revisa la coherencia de mi archivo"* | Recorre todas las páginas, te dice qué colores, textos, espaciados y botones se salen del sistema, y vincula lo que ya coincide |
| *"Revisa la accesibilidad"* | Revisa contraste, tamaño de botones y textos, y propone correcciones |
| *"Hazme la versión móvil y tablet"* | Copia la pantalla y la reorganiza para 768 y 390 px: tarjetas en columnas, tablas como tarjetas, menú aparte |
| *"Añade modo oscuro"* | Crea el tema oscuro en Figma y lo lleva a tu código |

## Instalación

**Necesitas:** [Figma Desktop](https://www.figma.com/downloads/) abierto,
[Node.js](https://nodejs.org/) 18.17 o superior y un asistente de IA que trabaje en tu computadora.
Funciona igual en **Windows, macOS y Linux**.

### 1. Ejecuta un solo comando

```bash
npx -y github:kennedy122112/figma-steroids setup
```

Instala figma-cli, añade las skills a cada IA que tengas (Claude Code, Codex, OpenCode, Cursor, Antigravity),
copia el plugin de Figma, **deja su ruta en el portapapeles** y abre su carpeta.

### 2. Importa el plugin en Figma (solo la primera vez)

En Figma Desktop: **Plugins → Development → Import plugin from manifest…**, pega la ruta en el
nombre de archivo y ábrelo con **Plugins → Development → figma-steroids**.

> **En macOS no se ve la carpeta:** está en `~/.figma-steroids/figma-plugin/`, que macOS oculta
> porque empieza con punto. En la ventana de Figma pulsa **Cmd + Shift + G**, pega la ruta
> (<kbd>Cmd</kbd>+<kbd>V</kbd>) y pulsa **Enter**. También sirve **Cmd + Shift + .** (punto) para mostrar
> las carpetas ocultas, o arrastrar el `manifest.json` desde el Finder a la ventana de Figma.

El comando lo detecta y muestra **✓ Conectado con Figma**. Listo: pídele diseños a tu IA.

Las siguientes veces solo abres el plugin. Si se queda en **"Buscando el daemon…"** (pasa después
de reiniciar la computadora), enciende figma-cli con `figma-cli daemon start` o pídele a tu IA
*"conecta con Figma"*.

> Figma no deja instalar plugins de desarrollo desde fuera: importar el plugin es el único paso
> que tienes que hacer a mano.

<details>
<summary>Instalación manual o por plugin de tu IA</summary>

1. `npm install -g figma-ds-cli`
2. Las skills:
   - **Claude Code:** `/plugin marketplace add kennedy122112/figma-steroids` y
     `/plugin install figma-steroids@figma-steroids`. En la pestaña Code de Claude Desktop no
     existe `/plugin`: ejecuta en la terminal `claude plugin marketplace add kennedy122112/figma-steroids`
     y `claude plugin install figma-steroids@figma-steroids`, y abre una sesión nueva.
   - **Codex:** `codex plugin marketplace add kennedy122112/figma-steroids` y
     `codex plugin add figma-steroids@figma-steroids`
   - **Otras:** `npx -y github:kennedy122112/figma-steroids init --ai opencode --global`
     (o `codex`, `cursor`, `antigravity`, `claude`, `universal`, `all`)
3. El plugin: `npx -y github:kennedy122112/figma-steroids plugin` y luego el paso 2 de arriba.
4. Enciende figma-cli (`figma-cli daemon start`), abre el plugin y dile a tu IA *"conecta con Figma"*.

</details>

### Actualizar

Vuelve a ejecutar `setup`, o en Claude Code con el plugin: `/plugin marketplace update figma-steroids`.

## ¿Dónde funciona?

En cualquier asistente que **trabaje en una carpeta de tu computadora y pueda ejecutar comandos**:
Claude Code (terminal, VS Code o la pestaña Code de Claude Desktop), Codex, OpenCode, Cursor o Antigravity.

No funciona en chats normales (claude.ai, ChatGPT) ni en versiones en la nube, porque no ven tu
Figma Desktop.

## Skills incluidas

| Skill | Para qué |
|---|---|
| `figma-setup` | Revisa e instala lo necesario la primera vez |
| `figma-connect` | Conecta con Figma Desktop |
| `figma-build-ui` | Diseña pantallas y componentes con tu design system |
| `figma-design-system` | Tokens, espaciado, estilos de texto, botón con variantes, modo oscuro, iconos |
| `figma-to-code` | Pasa un diseño a código en tu stack |
| `figma-from-code` | Lleva a Figma una pantalla que ya existe en tu app |
| `figma-consistency-audit` | Revisa todo el archivo: qué se sale de tu design system, lo vincula cuando es seguro y convierte botones o badges hechos a mano en un componente |
| `figma-a11y-review` | Revisa la accesibilidad |
| `figma-handoff` | Exporta imágenes, tokens y especificaciones para desarrollo |

Y tres agentes a los que tu IA puede delegar: uno construye UI, otro revisa diseños y otro vigila
que Figma y el código no se desincronicen.

## Problemas comunes

| Problema | Solución |
|---|---|
| "Plugin not detected" | Abre el plugin en Figma y déjalo abierto mientras trabajas |
| El plugin se queda en "Buscando el daemon…" | figma-cli está apagado: `figma-cli daemon start` y reabre el plugin |
| No encuentro `.figma-steroids` al importar el plugin (macOS) | En la ventana de Figma pulsa **Cmd + Shift + G** y pega `~/.figma-steroids/figma-plugin/manifest.json` |
| `/plugin` no existe en Claude Desktop | Usa `setup`, o `claude plugin marketplace add …` y `claude plugin install …` en la terminal |
| El daemon no responde | `figma-cli daemon restart`, o pídele a tu IA que vuelva a conectar |
| Los cambios van a otro archivo | Deja abierto solo el archivo en el que quieres trabajar |
| `npm install -g` falla por permisos | Sáltalo: las skills usan `npx -p figma-ds-cli figma-cli` |
| Las skills no aparecen | Reinicia tu IA. En Claude Code revisa `/plugin`; en otras, `npx -y github:kennedy122112/figma-steroids list` |

## Contribuir

Las skills y agentes son archivos Markdown con instrucciones: cualquiera puede mejorarlos o
añadir un stack nuevo. Cómo hacerlo, en [CONTRIBUTING.md](CONTRIBUTING.md). Lo que cambia en
cada versión, en [CHANGELOG.md](CHANGELOG.md).

## Créditos

Gracias a [Sil Bormüller](https://github.com/silships) ([Into Design Systems](https://intodesignsystems.com))
por [figma-cli](https://github.com/silships/figma-cli), la base de todo esto (licencia MIT). El
plugin de Figma de `figma-plugin/` parte de su plugin FigCli y le añade la interfaz.

## Proyectos hermanos

- [**ea-steroids**](https://github.com/kennedy122112/ea-steroids): modela arquitectura en Enterprise Architect desde tu agente de IA.
- [**bizagi-steroids**](https://github.com/kennedy122112/bizagi-steroids): describe un proceso y obtén el BPMN para Bizagi y su documento Word.
- [**blender-steroids**](https://github.com/kennedy122112/blender-steroids): modela escenas 3D en Blender desde tu agente de IA.
- [**ps-steroids**](https://github.com/kennedy122112/ps-steroids): diseña piezas gráficas por capas en Adobe Photoshop desde tu agente de IA, a partir de tu idea o tus fotos.

## Licencia

[MIT](LICENSE)
