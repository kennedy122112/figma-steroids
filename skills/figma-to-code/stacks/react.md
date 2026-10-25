# Adaptador: React + TypeScript

## Detección
- `react` en `package.json`. Framework: Next.js (`next`), Vite (`vite`), Remix, CRA…
- Next.js con `app/`: Server Components por defecto. Añade `'use client'` solo si el componente usa estado, efectos o eventos.
- Estilos: Tailwind, CSS Modules (`*.module.css`), styled-components / Emotion, o una librería (MUI, Chakra, shadcn/ui ya en el código).

## Convenciones del proyecto primero
Abre 2 o 3 componentes existentes: export por defecto o con nombre, `function` o
arrow, dónde viven los tipos, alias de imports (`@/components/...`) y si usan `cn()` / `clsx` / `cva`.

## Componente
- Función con nombre y props tipadas; las variantes de Figma como uniones literales:
  ```tsx
  type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'primary' | 'secondary' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
  };
  ```
- Si el proyecto usa `cva` (class-variance-authority), define ahí las variantes; si no, un mapa `Record<Variant, string>`.
- Extiende los atributos nativos del elemento y pasa `...props` y `ref`, para que el componente se comporte como el elemento HTML.
- Slots de Figma → `children` o props de tipo `React.ReactNode` con nombre (`icon`, `actions`).
- `export-jsx` de figma-cli sirve como **referencia de estructura**; reescribe el resultado con los componentes y tokens del proyecto.

## Estilos
- Tailwind: clases del tema, no valores arbitrarios; combina con `cn()` si existe.
- CSS Modules / CSS-in-JS: usa las variables CSS o el `theme` del proyecto.
- Estados: `hover`, `focus-visible`, `disabled`, `aria-invalid`.

## Accesibilidad
- Elementos nativos antes que `div` con `onClick`.
- Si el proyecto tiene Radix, React Aria o Headless UI, úsalos para menús, diálogos y popovers.

## Verificación
- `tsc --noEmit` (o el `typecheck` del proyecto), lint y tests (Vitest / Jest + Testing Library).
- QA visual: el servidor de desarrollo (`npm run dev`) o Storybook (`npm run storybook`).
