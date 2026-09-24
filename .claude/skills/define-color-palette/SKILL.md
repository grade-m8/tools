---
name: define-color-palette
description: Defines rules and TypeScript patterns for deriving, structuring, and implementing a functional color palette based on perceived usability, WCAG AA contrast, 60-30-10 distribution, predictable state luminances, and immutable TypeScript tokens.
---

# Define Color Palette

This skill defines the rules and technical patterns for deriving, structuring, and implementing a chromatic color palette in React and TypeScript. It ensures interfaces avoid visual fatigue, maintain accessible contrast, provide predictable state feedback, and enforce strict type safety using immutable design tokens.

## Usage

```
/define-color-palette [domain-or-component]
```

Example: `/define-color-palette grading-dashboard`

---

## 1. Distribución Semántica y Peso Perceptual

### Regla 60-30-10 Funcional
To avoid visual overload and maintain focus:
- **60% Superficie Neutra Base**: Dedicated to low-fatigue background surfaces (`bg-surface-base`, `bg-surface-subtle`).
- **30% Estructura y Soporte**: Assigned to structural containers, cards, borders, dividers, and secondary text (`bg-surface-raised`, `border-subtle`, `text-secondary`).
- **10% Acento Quirúrgico**: Reserved strictly for primary call-to-action (CTA) buttons, key focus indicators, active navigation states, and critical semantic feedback (`action-primary`, `feedback-error`).

### Calibración de Contraste Perceptual
- **WCAG AA Compliance**: All text and readable content must achieve a contrast ratio of at least **4.5:1** against its direct background (3:1 for large display headlines).
- **Luminosidad Perceptual**: Evaluate human visual perception of color contrast. Avoid high-saturation optical vibration (such as pure `#FF0000` text on dark backgrounds or bright blue text on green surfaces). Ensure text on chromatic backgrounds uses high-contrast light or dark neutrals.

---

## 2. Dinámica de Estados y Feedback Operativo

### Luminancia Predecible en Interacción
Interactive visual feedback must alter brightness predictably while preserving the base hue:
- **Hover State**: Reduce luminance by **8% to 12%** for light surfaces (or increase luminance by 8% to 12% for dark surfaces) to signal interactivity without shifting color tone.
- **Active State (Press)**: Deepen tone further (additional luminance adjustment) to provide tactile visual feedback upon click/press.
- **Focus-Visible State**: High-contrast accessible focus ring using a distinct accent or halo token (`ring-focus`).

### Estados Deshabilitados Legibles
- **No Low-Opacity Blurs**: Avoid blanket low opacity (such as `opacity-20` or `< 40%`) which makes labels illegible.
- **Legible Desaturation**: Communicate the disabled state through loss of saturation, removal of interactive borders, and neutral text styling (`text-disabled`), while preserving a minimum readable contrast for control labels.

---

## 3. Modelado y Tipado en TypeScript

### Tokens Semánticos sobre Valores Crudos
- Direct consumption of raw hex codes (`#2563eb`) inside React components is strictly prohibited.
- All styles must consume abstract semantic roles (`bg-surface-primary`, `text-body`, `action-primary-hover`).

### Inmutabilidad y Tipos Literales
Define design tokens as frozen objects with `as const` and extract strong literal types using `keyof typeof` to guarantee full IDE autocompletion and compile-time type validation:

```typescript
export const colorTokens = {
  surface: {
    base: '#ffffff',
    subtle: '#f8fafc',
    raised: '#ffffff',
    overlay: 'rgba(15, 23, 42, 0.6)',
  },
  text: {
    primary: '#0f172a',
    secondary: '#475569',
    disabled: '#94a3b8',
    inverse: '#ffffff',
  },
  action: {
    primary: '#2563eb',
    hover: '#1d4ed8',
    active: '#1e40af',
    focus: '#60a5fa',
  },
  border: {
    subtle: 'rgba(0, 0, 0, 0.08)',
    strong: 'rgba(0, 0, 0, 0.16)',
  },
  feedback: {
    error: '#dc2626',
    success: '#16a34a',
    warning: '#d97706',
    info: '#0284c7',
  },
} as const;

export type ColorTokenGroup = keyof typeof colorTokens;
export type ColorToken = typeof colorTokens;
```

---

## What NOT to do

- Don't hardcode hex codes or RGB strings inside `.tsx` component files.
- Don't use low opacity (`opacity-20`) to disable buttons, rendering labels unreadable.
- Don't use pure black (`#000000`) text on pure white (`#ffffff`) or pure saturated red text on dark backgrounds.
- Don't shift hue on hover (e.g. changing from blue to purple); modify luminance predictably.
