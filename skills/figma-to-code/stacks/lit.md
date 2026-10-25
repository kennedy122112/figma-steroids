# Adaptador: Lit (TypeScript o JavaScript)

## Detección
- `lit` en `package.json`.
- TypeScript si hay `tsconfig.json` y los componentes son `.ts`; si son `.js`, escribe JavaScript.
- Mira si usan decoradores (`@customElement`, `@property`) y si son de estilo legacy (`experimentalDecorators`) o estándar (`accessor`).

## Convenciones del proyecto primero
Abre 2 o 3 componentes existentes: prefijo del tag (`ui-`, `siaf-`…), si usan
Shadow DOM o light DOM, cómo comparten estilos (un `sharedStyles` importado) y cómo emiten eventos.

## Componente
- TypeScript con decoradores:
  ```ts
  @customElement('ui-button')
  export class UiButton extends LitElement {
    @property({ reflect: true }) variant: 'primary' | 'secondary' | 'ghost' = 'primary';
    @property({ reflect: true }) size: 'sm' | 'md' | 'lg' = 'md';
    @property({ type: Boolean, reflect: true }) disabled = false;
  }
  ```
- JavaScript sin decoradores: `static properties = { variant: { reflect: true } }` y `customElements.define(...)`.
- Variantes de Figma → propiedades **reflejadas** como atributos, para poder estilarlas con `:host([variant='primary'])`.
- Slots de Figma → `<slot>` y `<slot name="icon">`.
- Eventos: `this.dispatchEvent(new CustomEvent('ui-click', { bubbles: true, composed: true }))`.
- Registra el tipo del tag en `HTMLElementTagNameMap` (TypeScript).

- Datos estructurados (listas de estadísticas, elementos) → `@property({ type: Array })`; desde
  HTML se pasan como JSON en el atributo (`stats='[{"label":"…","value":"…"}]'`).

## Estilos
- ``static styles = css`...` `` con **variables CSS** para los tokens (`var(--color-primary)`). Las variables atraviesan el Shadow DOM; las clases de Tailwind no.
- Si el proyecto usa Tailwind dentro de Lit (light DOM, o estilos de Tailwind inyectados en `static styles`), sigue ese mismo patrón y no lo mezcles con otro.
- Expón puntos de personalización con `::part()` y variables CSS, documentados en el JSDoc del componente.
- **Modo oscuro:** redefine las variables en `.dark` sobre `<html>`; los componentes las heredan a
  través del Shadow DOM sin cambiar su código.
- El trazo de Figma no ocupa espacio: borde con `box-shadow: inset 0 0 0 1px var(--color-border)`.
- Fíjate en la configuración de TypeScript: con `experimentalDecorators` (la plantilla de Vite)
  se usa `@property()` sobre campos normales; con decoradores estándar, `@property() accessor`.
- Estados: `:host(:hover)`, `:focus-visible`, `:host([disabled])`.

## Accesibilidad
- Con Shadow DOM, el `<button>` nativo debe estar dentro del componente. Si el componente es un control de formulario, usa `ElementInternals` (`static formAssociated = true`).
- `delegatesFocus: true` en `shadowRootOptions` cuando el host debe recibir el foco.

## Verificación
- `tsc --noEmit` (si es TS), lint (`lit-analyzer` si está configurado) y tests (`@web/test-runner` o Vitest).
- QA visual: el servidor de desarrollo o Storybook para web components.
