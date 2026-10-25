# Adaptador: genérico (cualquier otro stack)

Úsalo cuando no haya un adaptador específico (Vue, Svelte, Flutter, SwiftUI, HTML/CSS…).
Si el stack es habitual, considera aportar su adaptador (ver CONTRIBUTING.md).

## Detección
Identifica framework, lenguaje, sistema de estilos y librería de componentes a
partir de los manifiestos del proyecto (`package.json`, `pubspec.yaml`,
`Package.swift`, `build.gradle`…). Si dudas, pregunta.

## Convenciones del proyecto primero
Sin un adaptador, el propio proyecto es la guía: abre los componentes más
parecidos al que vas a crear e imita su estructura, nombres, estilos y tests.

## Componente
- Variantes de Figma → props o parámetros tipados con valores cerrados (enums o uniones).
- Slots de Figma → el mecanismo de composición del stack (children, slots, builders…).
- Tokens → el sistema de temas del stack; si no existe, variables CSS o constantes centralizadas, nunca valores sueltos.

## Verificación
Compilación o typecheck, lint y tests del proyecto, y QA visual contra la captura de `figma-cli verify`.
