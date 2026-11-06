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
node scripts/wireframe.mjs --id "<id de la pantalla>" [--style gris]
```
Crea `<pantalla> · Wireframe` a la derecha de lo que hay en la página (la original no se toca;
si ya existe, la rehace). Solo cambia el aspecto:

| En el diseño | En el wireframe |
|---|---|
| Cajas, tarjetas y secciones claras | Papel con borde fino |
| Barras, botones o avatares de color oscuro | Gris suave con borde fino |
| Textos e iconos | El color del estilo, en su sitio y con su tamaño |
| Imágenes | Caja gris con una X |
| Sombras y degradados | Fuera |

El auto-layout, los textos, los nombres de capa y las instancias se conservan: el wireframe se
puede seguir editando, hacer responsive (`figma-build-ui`) o convertir en flujo.

Estilos (`--style`): `gris` (por defecto), `azul`, `blueprint` (líneas blancas sobre azul), `rosa`,
`verde`, `dorado`, `carbon`. El script devuelve cuántas cajas, textos, iconos e imágenes cambió.

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
