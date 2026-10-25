---
name: figma-setup
description: Primer arranque de figma-steroids. Comprueba que el entorno puede controlar Figma Desktop (agente ejecutándose en la computadora del usuario, Node.js, figma-cli y el plugin FigCli) e instala lo que falte con permiso del usuario, sin que tenga que abrir una terminal. Úsala la primera vez, cuando el usuario diga "configura figma-steroids", "prepara Figma", "set up figma", "no funciona la conexión", o cuando figma-cli no exista.
---

# Primer arranque

El usuario puede estar en una app de escritorio (Claude Desktop, Codex, Cursor…) y no saber
usar la terminal: **ejecuta tú los comandos** y explícale cada paso en lenguaje sencillo.
Instala solo con su permiso, diciéndole antes qué vas a instalar.

## 0. ¿Este entorno puede funcionar?
figma-cli habla con Figma Desktop a través de la propia computadora (`localhost`). Solo
funciona si **este agente corre en la misma máquina que Figma Desktop** y puede ejecutar comandos.

- Si no puedes ejecutar comandos (un chat sin herramientas de terminal), o estás en un entorno
  en la nube (Claude Code en la web, tareas de Codex en la nube, un contenedor remoto), **para
  aquí** y explícaselo al usuario: debe usar una app que trabaje en su computadora (Claude
  Desktop en la pestaña Code, Codex, Cursor, OpenCode, Claude Code en la terminal). Si solo
  necesita leer un diseño, el conector MCP oficial de Figma es la alternativa.
- Señal de que estás en otra máquina: Figma no aparece entre los procesos (paso 3) aunque el
  usuario dice que lo tiene abierto.

## 1. Node.js 18.17 o superior
`node -v`

Si falta o es antiguo, propón instalarlo:
- **Windows:** `winget install OpenJS.NodeJS.LTS`
- **macOS:** `brew install node` (si no hay Homebrew, indica la descarga de https://nodejs.org)
- **Linux:** el gestor de paquetes de la distribución, o https://nodejs.org

Después de instalar, puede hacer falta abrir una sesión nueva para que `node` aparezca en el PATH.

## 2. figma-cli
`figma-cli --version`

Si no existe, propón `npm install -g figma-ds-cli`. Si falla por permisos, no insistas: usa
`npx -p figma-ds-cli figma-cli` en todos los comandos (es más lento, pero no instala nada global).
El paquete npm se llama `figma-ds-cli`; `npx figma-cli` a secas instalaría otro paquete.

## 3. Figma Desktop abierto
- **Windows:** `tasklist /FI "IMAGENAME eq Figma.exe"`
- **macOS:** `pgrep -x Figma`
- **Linux:** `pgrep -f figma`

Si no está abierto, pide al usuario que abra Figma Desktop (la versión web no sirve) y un archivo de diseño.

## 4. El plugin FigCli (una sola vez)
Calcula la ruta del manifiesto y **dásela al usuario lista para copiar**:
- Instalación global (recomendada): `npm root -g` → `<resultado>/figma-ds-cli/plugin/manifest.json`.
- Solo con npx: el paquete vive en la caché de npm (`npm config get cache`), en
  `<caché>/_npx/<id>/node_modules/figma-ds-cli/plugin/manifest.json`; búscalo con un glob.
  Avisa al usuario de que esa caché puede borrarse: si el plugin deja de cargar, habrá que
  importarlo de nuevo. Por eso conviene la instalación global.

Luego pídele que, en Figma: **Plugins → Development → Import plugin from manifest…**, elija
ese archivo, y después abra **Plugins → Development → FigCli** y lo deje abierto.

**Alternativa recomendada: el plugin figma-steroids.** Hace lo mismo que FigCli y además
muestra el archivo conectado, la selección con su ID para copiarla, un registro de lo que
hace la IA (lecturas, nodos creados, modificados y borrados, errores) y un botón de **pausa**.
`npx -y github:kennedy122112/figma-steroids plugin` lo copia a una carpeta estable y muestra
la ruta de su `manifest.json`; se importa igual y se abre con
**Plugins → Development → figma-steroids**. Usa uno de los dos plugins, no ambos a la vez:
el daemon solo atiende al último que se conecta.

## 5. Conectar y comprobar
Sigue la skill `figma-connect`. La configuración termina cuando
`figma-cli eval 'figma.root.name'` devuelve el nombre del archivo abierto.

## Entrega
Un resumen corto: qué estaba listo, qué instalaste y qué falta que haga el usuario (si algo).
Si todo quedó conectado, termina con algo como: "Listo, ¿qué quieres crear en Figma?".
