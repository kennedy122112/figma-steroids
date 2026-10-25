# Adaptador: Angular + TypeScript (+ Tailwind)

## Detección
- `angular.json`, o `@angular/core` en `package.json`.
- Versión: mira `@angular/core`. Desde la v17 usa control flow (`@if`, `@for`) y signals; en versiones anteriores, `*ngIf` / `*ngFor`.
- Tailwind: `tailwind.config.*`, o `@import "tailwindcss"` / `@tailwind` en `styles.css` / `styles.scss`.
- Librería de UI: Angular Material, PrimeNG, Spartan/ng, o una librería interna en `projects/` o en `node_modules/@<org>/…`.

## Convenciones del proyecto primero
Antes de escribir, abre 2 o 3 componentes existentes y copia su estilo:
standalone o NgModule, prefijo del selector (`app-`, `siaf-`…), `inputs` con
`input()` o con `@Input()`, archivos separados o template inline, y estructura de carpetas.

## Componente
- Por defecto: **standalone**, `ChangeDetectionStrategy.OnPush`, selector con el prefijo del proyecto.
- Variantes de Figma → inputs tipados con uniones literales:
  ```ts
  readonly variant = input<'primary' | 'secondary' | 'ghost'>('primary');
  readonly size = input<'sm' | 'md' | 'lg'>('md');
  readonly clicked = output<void>();
  ```
- Clases según la variante: un `computed()` que devuelva el string de clases,
  o un mapa `Record<Variant, string>`. Nada de lógica larga en el template.
- Contenido flexible (slots de Figma) → `<ng-content>`, con `select` si hay varios.
- Iconos: usa el sistema de iconos que ya tenga el proyecto (por ejemplo `lucide-angular`); no metas SVG inline si ya existe uno.

## Estilos con Tailwind
- Usa las clases que vienen del tema (`bg-primary`, `text-muted-foreground`), no valores arbitrarios (`bg-[#1d4ed8]`).
- Tokens nuevos: añádelos en `tailwind.config` (`theme.extend`) o en el bloque `@theme` (Tailwind v4), según lo que use el proyecto.
- Estados: `hover:`, `focus-visible:`, `disabled:` y `aria-[invalid=true]:`.
- Si el proyecto usa SCSS por componente en lugar de Tailwind, usa variables CSS (`var(--color-primary)`) en el `.scss`.

## Accesibilidad
- Elementos nativos (`<button>`, `<a>`, `<input>`) antes que `div` con `(click)`.
- Con Angular CDK disponible, úsalo para foco, overlays y `a11y` (`cdkTrapFocus`, `LiveAnnouncer`).

## Verificación
- `ng build` (o `npm run build`) sin errores y `ng lint` si está configurado.
- Si hay tests (`*.spec.ts`), añade al menos uno que renderice cada variante.
- QA visual: `ng serve`, o Storybook si el proyecto lo tiene (`npm run storybook`).
