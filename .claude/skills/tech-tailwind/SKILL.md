---
name: tech-tailwind
description: Melhores praticas TailwindCSS - Utilities, Responsive, Dark Mode, Componentes
version: 1.0.0
---

# TailwindCSS - Melhores Praticas

## Configuracao

### tailwind.config.js
```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
```

---

## Classes Essenciais

### Layout
```html
<!-- Flexbox -->
<div class="flex items-center justify-between gap-4">
  <div class="flex-1">Content</div>
  <div class="flex-shrink-0">Fixed</div>
</div>

<!-- Grid -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  <div>Item 1</div>
  <div>Item 2</div>
  <div>Item 3</div>
</div>

<!-- Container -->
<div class="container mx-auto px-4">
  Content
</div>
```

### Spacing
```html
<!-- Padding -->
<div class="p-4">All sides</div>
<div class="px-6 py-4">Horizontal/Vertical</div>
<div class="pt-4 pr-6 pb-8 pl-2">Individual</div>

<!-- Margin -->
<div class="m-4">All sides</div>
<div class="mx-auto">Center horizontally</div>
<div class="mt-8 mb-4">Top/Bottom</div>
<div class="-mt-4">Negative margin</div>

<!-- Gap (flex/grid) -->
<div class="flex gap-4">Items</div>
<div class="grid gap-x-6 gap-y-4">Items</div>
```

### Sizing
```html
<!-- Width -->
<div class="w-full">100%</div>
<div class="w-1/2">50%</div>
<div class="w-64">16rem (256px)</div>
<div class="w-screen">100vw</div>
<div class="max-w-md">max 28rem</div>
<div class="min-w-0">min 0</div>

<!-- Height -->
<div class="h-full">100%</div>
<div class="h-screen">100vh</div>
<div class="h-64">16rem</div>
<div class="min-h-screen">min 100vh</div>
```

### Typography
```html
<!-- Font Size -->
<p class="text-xs">12px</p>
<p class="text-sm">14px</p>
<p class="text-base">16px</p>
<p class="text-lg">18px</p>
<p class="text-xl">20px</p>
<p class="text-2xl">24px</p>
<p class="text-3xl">30px</p>

<!-- Font Weight -->
<p class="font-light">300</p>
<p class="font-normal">400</p>
<p class="font-medium">500</p>
<p class="font-semibold">600</p>
<p class="font-bold">700</p>

<!-- Text Alignment -->
<p class="text-left">Left</p>
<p class="text-center">Center</p>
<p class="text-right">Right</p>

<!-- Text Transform -->
<p class="uppercase">UPPERCASE</p>
<p class="lowercase">lowercase</p>
<p class="capitalize">Capitalize</p>

<!-- Line Height -->
<p class="leading-tight">1.25</p>
<p class="leading-normal">1.5</p>
<p class="leading-relaxed">1.625</p>

<!-- Text Wrap -->
<p class="truncate">Truncate with ellipsis</p>
<p class="line-clamp-2">Limit to 2 lines</p>
```

### Colors
```html
<!-- Text -->
<p class="text-gray-900 dark:text-gray-100">Texto</p>
<p class="text-blue-500">Azul</p>
<p class="text-red-600">Vermelho</p>

<!-- Background -->
<div class="bg-white dark:bg-gray-900">Background</div>
<div class="bg-blue-500">Azul</div>
<div class="bg-gradient-to-r from-blue-500 to-purple-500">Gradient</div>

<!-- Border -->
<div class="border border-gray-300">Border</div>
<div class="border-2 border-blue-500">Blue border</div>
```

### Borders & Radius
```html
<!-- Border Width -->
<div class="border">1px</div>
<div class="border-2">2px</div>
<div class="border-t-4">Top 4px</div>

<!-- Border Radius -->
<div class="rounded">4px</div>
<div class="rounded-md">6px</div>
<div class="rounded-lg">8px</div>
<div class="rounded-xl">12px</div>
<div class="rounded-2xl">16px</div>
<div class="rounded-full">50%</div>

<!-- Specific corners -->
<div class="rounded-t-lg">Top corners</div>
<div class="rounded-bl-lg">Bottom-left</div>
```

### Shadows
```html
<div class="shadow-sm">Small</div>
<div class="shadow">Default</div>
<div class="shadow-md">Medium</div>
<div class="shadow-lg">Large</div>
<div class="shadow-xl">Extra large</div>
<div class="shadow-2xl">2X large</div>
<div class="shadow-inner">Inner shadow</div>
<div class="shadow-none">No shadow</div>
```

---

## Responsive Design

### Breakpoints
| Prefixo | Min-width | CSS |
|---------|-----------|-----|
| `sm:` | 640px | `@media (min-width: 640px)` |
| `md:` | 768px | `@media (min-width: 768px)` |
| `lg:` | 1024px | `@media (min-width: 1024px)` |
| `xl:` | 1280px | `@media (min-width: 1280px)` |
| `2xl:` | 1536px | `@media (min-width: 1536px)` |

### Mobile-First
```html
<!-- Texto responsivo -->
<p class="text-sm md:text-base lg:text-lg">
  Texto adaptativo
</p>

<!-- Grid responsivo -->
<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
  <div>Item</div>
</div>

<!-- Flexbox responsivo -->
<div class="flex flex-col md:flex-row gap-4">
  <div class="w-full md:w-1/3">Sidebar</div>
  <div class="w-full md:w-2/3">Content</div>
</div>

<!-- Padding responsivo -->
<section class="px-4 md:px-8 lg:px-16 py-8 md:py-12">
  Content
</section>

<!-- Ocultar/mostrar -->
<div class="hidden md:block">Apenas desktop</div>
<div class="block md:hidden">Apenas mobile</div>
```

---

## Dark Mode

### Implementacao
```html
<!-- Toggle via classe no html -->
<html class="dark">

<!-- Componente com dark mode -->
<div class="bg-white dark:bg-gray-900">
  <h1 class="text-gray-900 dark:text-white">Titulo</h1>
  <p class="text-gray-600 dark:text-gray-400">Texto</p>
  <button class="bg-blue-500 dark:bg-blue-600 text-white">
    Botao
  </button>
</div>

<!-- Card com dark mode -->
<div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-md dark:shadow-gray-900/50 p-6">
  <h2 class="text-gray-900 dark:text-gray-100">Card Title</h2>
  <p class="text-gray-600 dark:text-gray-400">Card content</p>
</div>
```

---

## State Variants

### Hover, Focus, Active
```html
<!-- Hover -->
<button class="bg-blue-500 hover:bg-blue-600 transition-colors">
  Hover me
</button>

<!-- Focus -->
<input class="border focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none" />

<!-- Active -->
<button class="active:scale-95 transition-transform">
  Press me
</button>

<!-- Focus Visible (apenas teclado) -->
<button class="focus-visible:ring-2 focus-visible:ring-blue-500">
  Tab to focus
</button>

<!-- Disabled -->
<button class="disabled:opacity-50 disabled:cursor-not-allowed" disabled>
  Disabled
</button>
```

### Group Hover
```html
<div class="group cursor-pointer">
  <h3 class="group-hover:text-blue-500 transition-colors">
    Titulo
  </h3>
  <p class="opacity-0 group-hover:opacity-100 transition-opacity">
    Aparece no hover
  </p>
</div>
```

### Peer States
```html
<input type="checkbox" class="peer" />
<div class="hidden peer-checked:block">
  Aparece quando marcado
</div>
```

---

## Transitions & Animations

### Transitions
```html
<!-- Todas propriedades -->
<div class="transition-all duration-300 ease-in-out">
  Content
</div>

<!-- Propriedades especificas -->
<button class="transition-colors duration-200">Colors</button>
<div class="transition-transform duration-300">Transform</div>
<div class="transition-opacity duration-500">Opacity</div>

<!-- Timing functions -->
<div class="ease-linear">Linear</div>
<div class="ease-in">Ease in</div>
<div class="ease-out">Ease out</div>
<div class="ease-in-out">Ease in-out</div>
```

### Animations
```html
<div class="animate-spin">Spinning</div>
<div class="animate-ping">Pinging</div>
<div class="animate-pulse">Pulsing</div>
<div class="animate-bounce">Bouncing</div>
```

---

## Componentes Reutilizaveis

### Button
```html
<!-- Primary -->
<button class="
  inline-flex items-center justify-center
  px-4 py-2
  text-sm font-medium text-white
  bg-blue-500 hover:bg-blue-600
  border border-transparent rounded-lg
  shadow-sm
  transition-colors duration-200
  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
  disabled:opacity-50 disabled:cursor-not-allowed
">
  Primary Button
</button>

<!-- Secondary -->
<button class="
  inline-flex items-center justify-center
  px-4 py-2
  text-sm font-medium text-gray-700 dark:text-gray-200
  bg-white dark:bg-gray-800
  border border-gray-300 dark:border-gray-600 rounded-lg
  shadow-sm
  hover:bg-gray-50 dark:hover:bg-gray-700
  transition-colors duration-200
  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
">
  Secondary Button
</button>
```

### Input
```html
<input
  type="text"
  class="
    w-full px-3 py-2
    text-sm text-gray-900 dark:text-gray-100
    bg-white dark:bg-gray-800
    border border-gray-300 dark:border-gray-600 rounded-lg
    placeholder:text-gray-500
    focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800
    outline-none
    transition-colors duration-200
  "
  placeholder="Digite aqui..."
/>
```

### Card
```html
<div class="
  bg-white dark:bg-gray-800
  border border-gray-200 dark:border-gray-700
  rounded-xl
  shadow-sm
  overflow-hidden
">
  <div class="p-6">
    <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
      Card Title
    </h3>
    <p class="mt-2 text-gray-600 dark:text-gray-400">
      Card description goes here.
    </p>
  </div>
</div>
```

### Badge
```html
<span class="
  inline-flex items-center
  px-2.5 py-0.5
  text-xs font-medium
  bg-blue-100 dark:bg-blue-900
  text-blue-800 dark:text-blue-200
  rounded-full
">
  Badge
</span>
```

---

## Organizacao de Classes

### Ordem Recomendada
1. Display & Position (`flex`, `absolute`, `z-10`)
2. Box Model (`w-full`, `h-64`, `p-4`, `m-2`)
3. Typography (`text-lg`, `font-bold`)
4. Colors (`bg-white`, `text-gray-900`)
5. Borders (`border`, `rounded-lg`)
6. Effects (`shadow-md`, `opacity-50`)
7. Transitions (`transition-colors`, `duration-200`)
8. States (`hover:`, `focus:`, `dark:`)

### Exemplo Organizado
```html
<button class="
  flex items-center justify-center
  w-full px-4 py-2
  text-sm font-medium text-white
  bg-blue-500
  border border-blue-600 rounded-lg
  shadow-sm
  transition-all duration-200
  hover:bg-blue-600 hover:shadow-md
  focus:ring-2 focus:ring-blue-300
  disabled:opacity-50
  dark:bg-blue-600 dark:hover:bg-blue-700
">
  Button
</button>
```

---

## Checklist de Boas Praticas

- [ ] Mobile-first (comece sem prefixos, adicione `md:`, `lg:`)
- [ ] Dark mode em todos componentes
- [ ] Transitions para interacoes
- [ ] Focus states para acessibilidade
- [ ] Evitar classes duplicadas
- [ ] Usar variaveis do tema
- [ ] Componentes consistentes
- [ ] Classes ordenadas logicamente
