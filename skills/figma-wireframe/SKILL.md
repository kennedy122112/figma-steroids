---
name: figma-wireframe
description: Wireframes en Figma. De una idea contada por chat a un flujo de pantallas en baja fidelidad (mapa de pantallas, kit de componentes, pantallas con auto-layout y prototipo navegable), o de una pantalla terminada a su wireframe editable (gris como Wire Box, azul, blueprint…). Úsala cuando el usuario diga "tengo una idea de app", "hazme los wireframes de…", "de la idea a wireframes", "boceta el flujo de…", "pásala a wireframe", "hazme el wireframe", "versión de baja fidelidad", "lo-fi", "en blanco y negro para el test de usabilidad", "quítale el diseño para enseñar la estructura", "wireframe this screen".
---

# Wireframes en Figma

Requisito: conexión activa (skill `figma-connect`).

Un wireframe enseña la estructura sin que la gente se fije en colores, fotos o detalles: sirve para
tests de usabilidad, propuestas tempranas, documentar flujos o discutir la arquitectura de
información con negocio.

## De la idea a wireframes
Cuando el usuario cuenta una idea ("un control biométrico fácil para la asistencia"):

1. **El mapa, antes de dibujar.** Pregunta solo lo que cambia el diseño (quién lo usa y en qué
   dispositivo: app móvil, web, kiosco…) y propón la lista de pantallas en el orden del flujo, con
   una línea de lo que lleva cada una, incluidos los casos de error y los estados vacíos. Espera a
   que la apruebe o la cambie: aquí se decide la arquitectura de información.
2. **Dónde.** Un archivo o una página propia; no mezcles otra app en un proyecto existente sin
   preguntar. figma-cli trabaja en el archivo donde está abierto el plugin (solo uno a la vez).
3. **La descripción en JSON** de las pantallas con las piezas del kit (formato al principio de
   `scripts/screens.mjs`): barra superior, cuerpo, pestañas y `links` (qué texto lleva a qué
   pantalla). Usa textos reales y verosímiles, no "Lorem ipsum": un nombre, una hora, una sede. Ejemplo
   completo: `examples/asistencia-biometrica.json`.
4. **Dibujarlas:**
   ```
   node scripts/screens.mjs pantallas.json
   ```
   Crea la primera vez el **kit de wireframe** como componentes a la izquierda (Botón, Botón
   principal, Campo, Tarjeta, Fila, Imagen, Visor de cámara, Barra superior, Pestañas, Chip, Avatar)
   y luego cada pantalla con auto-layout, en fila y en el orden del flujo, con flechas entre las
   vecinas, debajo a dónde lleva cada una, y los **enlaces de prototipo** (Presentar en Figma y se
   navega). Repetirlo rehace las pantallas con el mismo nombre, sin duplicar.
5. **Revisar:** captura cada pantalla (`figma-cli verify "<id>" --save …`), corrige lo que no se
   lea bien en el JSON y vuelve a ejecutarlo. Enséñale el resultado y pregunta qué ajustar.

Después: `figma-build-ui` para hacerlo responsive o pasarlo a alta fidelidad con su design system.

## De una pantalla terminada a wireframe
```
node scripts/wireframe.mjs --id "<id de la pantalla>" [--look wirebox|suave] [--style gris]
```
Crea `<pantalla> · Wireframe (<estilo>)` a la derecha de lo que hay en la página (la original no
se toca; si ya existe, la rehace). Solo cambia el aspecto. Dos aspectos:

| En el diseño | `wirebox` (por defecto, como Wire Box) | `suave` |
|---|---|---|
| Cajas, tarjetas, secciones, círculos | Blanco con línea de 1 px del color del estilo | Claras → papel, oscuras → gris suave, borde al 70 % |
| Iconos | Solo contorno | Rellenos del color del estilo |
| Textos | Color del estilo, todos en Roboto Regular | Color del estilo, con su fuente y su peso |
| Imágenes | Caja blanca con una X | Caja gris con una X |
| Sombras y degradados | Fuera | Fuera |

El auto-layout, los textos, los nombres de capa y las instancias se conservan: el wireframe se
puede seguir editando, hacer responsive (`figma-build-ui`) o convertir en flujo.

Estilos (`--style`): `gris` (por defecto), `rosa`, `azul`, `verde`, `dorado`, `carbon` (los colores
de Wire Box) y `blueprint` (líneas blancas sobre azul). Si el usuario muestra una referencia de Wire Box, usa `wirebox`; si quiere algo más
sobrio para clientes, `--look suave`. El script devuelve cuántas cajas, textos, iconos e imágenes cambió.

Después, captura el resultado (`figma-cli verify "<id>" --save …`) y enséñaselo. Si algo importante
quedó poco visible (un botón principal que ya no destaca), propón marcarlo, por ejemplo con el
borde más grueso o el texto en negrita.

## Diseñar directamente en wireframe
Si el usuario pide una pantalla nueva "en wireframe" o "en baja fidelidad", constrúyela con
`figma-build-ui` usando solo tres colores: papel (`#ffffff`), gris suave (`#e5e7eb`) y tinta
(`#4b5563`), bordes de 1 px, Inter Regular/Semi Bold, imágenes como cajas grises con una X y sin
sombras. Mantén igualmente el auto-layout y el espaciado de la escala: pasar después a alta
fidelidad será cambiar estilos, no rehacer.

## Reglas
- No toques la pantalla original ni los componentes principales: el estilo se aplica a la copia
  (en las instancias, como cambios sobre la instancia).
- El texto real se queda: un wireframe con "Lorem ipsum" esconde problemas de contenido. Si el
  usuario quiere textos de relleno, pregúntalo.
