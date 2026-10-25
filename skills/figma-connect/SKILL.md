---
name: figma-connect
description: Conecta el agente con Figma Desktop usando figma-cli en modo plugin (Safe), sin API key ni MCP. Úsala cuando el usuario diga "conecta con Figma", "connect to Figma", cuando un comando figma-cli falle por falta de conexión, o antes de cualquier tarea de diseño si no hay conexión activa.
---

# Conectar con Figma (modo plugin)

figma-cli controla Figma Desktop de forma local. Esta skill usa el **modo Safe**:
un plugin de desarrollo de Figma (FigCli) hace de puente con un daemon local.
No modifica la app de Figma y no envía nada a la nube.

Si es la primera vez, falta Node.js o figma-cli, o no sabes si este entorno puede llegar a
Figma Desktop, sigue antes la skill `figma-setup`.

## 1. Encontrar el comando
- Si existe `figma-cli` en el PATH, úsalo.
- Si no, usa `npx -p figma-ds-cli figma-cli` (el paquete npm se llama `figma-ds-cli`;
  `npx figma-cli` a secas buscaría otro paquete distinto).
- Para dejarlo instalado: `npm install -g figma-ds-cli`.

En el resto de las skills, `figma-cli` significa el comando que encontraste aquí.

## 2. Arrancar el daemon
Ejecuta `figma-cli connect --safe` **en segundo plano** y no lo cortes con un timeout
(si lo matas, el daemon se detiene). Si el plugin aún no está abierto, el comando termina
solo con "Plugin not detected yet" pero el daemon sigue escuchando: no hay que relanzarlo.
Comprueba con `figma-cli daemon status` (debe decir que corre en el puerto 3456).

## 3. Pedirle al usuario que abra el plugin
Esto solo lo puede hacer el usuario, en Figma Desktop:

- **Una sola vez:** Plugins → Development → *Import plugin from manifest…* y elegir
  `plugin/manifest.json` dentro del paquete figma-cli: en una instalación global está en
  `<npm root -g>/figma-ds-cli/plugin/manifest.json`; en una local, en `node_modules/figma-ds-cli/plugin/`.
- **Cada sesión:** Plugins → Development → **FigCli**, y dejarlo abierto.

## 4. Verificar
`figma-cli eval 'figma.root.name'` debe devolver el nombre del archivo abierto.
Si hay varios archivos abiertos, fija el destino con
`FIGMA_FILE="parte del nombre" figma-cli <comando>`.

## Problemas frecuentes
- **"Plugin not detected"**: el plugin FigCli no está abierto o se cerró. Pídele al usuario que lo vuelva a abrir.
- **El daemon no corre**: `figma-cli daemon restart`.
- **Errores que mencionan el token (`.daemon-token`)**: quedó un daemon de otra sesión u otra
  herramienta con el token desincronizado. `figma-cli daemon restart` lo arregla y el plugin
  FigCli se reconecta solo.
- **Comandos que van al archivo equivocado**: usa `FIGMA_FILE`.

No le muestres comandos de terminal al usuario. Ejecútalos tú e informa el resultado en lenguaje sencillo.
