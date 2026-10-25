---
name: figma-a11y-review
description: Audita la accesibilidad de un diseño en Figma con figma-cli (contraste WCAG, tamaño de zonas táctiles, tamaño de texto y simulación de daltonismo) y entrega un informe priorizado con correcciones. Úsala cuando el usuario diga "revisa la accesibilidad", "chequea el contraste", "¿cumple WCAG?", "a11y audit", o antes de entregar una pantalla.
---

# Revisión de accesibilidad

Requisito: conexión activa (skill `figma-connect`).

## Pasos
1. Pídele al usuario que seleccione el frame o la pantalla, o localízalo con `figma-cli find "<nombre>"`.
2. Ejecuta `figma-cli a11y audit "<id>"` para la revisión completa (contraste, zonas táctiles,
   texto y orden de foco; `--level AAA` para el nivel más estricto, `--json` para procesarlo).
   Sin ID revisa toda la página. Para profundizar:
   - `figma-cli a11y contrast`: contraste de texto y fondo (AA: 4.5:1 en texto normal, 3:1 en texto grande).
   - `figma-cli a11y touch`: zonas táctiles (mínimo 44×44 en iOS, 48×48 en Android).
   - `figma-cli a11y text`: tamaños de texto demasiado pequeños.
   - `figma-cli a11y vision`: simulación de daltonismo.
   - `figma-cli a11y focus`: orden de lectura y de foco de los elementos interactivos.
3. Entrega un informe ordenado por gravedad:

| Gravedad | Elemento | Problema | Corrección propuesta |
|---|---|---|---|
| Alta | Botón "Pagar" | Contraste 2.8:1 | Usar `var:primary-strong` |

## Reglas
- **No corrijas nada sin permiso.** Primero el informe; luego aplica solo lo que el usuario apruebe.
- Propón correcciones con variables del design system, no con colores sueltos.
- Si corriges algo, vuelve a ejecutar la verificación para confirmar que quedó resuelto.
