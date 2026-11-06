---
name: figma-wireframe
description: Pasa una pantalla de Figma a wireframe (baja fidelidad) sin perder la estructura - una copia editable a su derecha, con el auto-layout, los textos y las instancias intactos, en gris, azul, blueprint u otro estilo. También diseña pantallas nuevas directamente en wireframe. Úsala cuando el usuario diga "pásala a wireframe", "hazme el wireframe", "versión de baja fidelidad", "lo-fi", "en blanco y negro para el test de usabilidad", "quítale el diseño para enseñar la estructura", "wireframe this screen".
---

# Wireframes en Figma

Requisito: conexión activa (skill `figma-connect`).

Un wireframe enseña la estructura sin que la gente se fije en colores, fotos o detalles: sirve para
tests de usabilidad, propuestas tempranas, documentar flujos o discutir la arquitectura de
información con negocio.

## De una pantalla terminada a wireframe
```
node scripts/wireframe.mjs --id "<id de la pantalla>" [--look wirebox|suave] [--style rosa]
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

Estilos (`--style`): `rosa` (por defecto en `wirebox`, el de Wire Box), `azul`, `verde`, `dorado`,
`carbon` (los cinco de Wire Box), `gris` (por defecto en `suave`) y `blueprint` (líneas blancas
sobre azul). Si el usuario muestra una referencia de Wire Box, usa `wirebox`; si quiere algo más
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
