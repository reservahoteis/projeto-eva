---
name: tech-radix
description: Melhores praticas Radix UI - Primitivos Acessiveis, Composicao, Estilizacao, Headless Components
version: 1.0.0
---

# Radix UI - Melhores Praticas

## Introducao

Radix UI e uma biblioteca de primitivos de UI acessiveis e sem estilo (headless) para React. Fornece componentes de baixo nivel que podem ser estilizados com qualquer solucao CSS.

```typescript
import * as Dialog from '@radix-ui/react-dialog';

export function Modal() {
  return (
    <Dialog.Root>
      <Dialog.Trigger>Abrir</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content>
          <Dialog.Title>Titulo</Dialog.Title>
          <Dialog.Description>Descricao</Dialog.Description>
          <Dialog.Close>Fechar</Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

---

## Instalacao

```bash
# Instalar componentes individualmente
npm install @radix-ui/react-dialog
npm install @radix-ui/react-dropdown-menu
npm install @radix-ui/react-tabs
npm install @radix-ui/react-toast
npm install @radix-ui/react-tooltip
npm install @radix-ui/react-popover
npm install @radix-ui/react-select
npm install @radix-ui/react-checkbox
npm install @radix-ui/react-switch
npm install @radix-ui/react-slider
npm install @radix-ui/react-accordion
npm install @radix-ui/react-alert-dialog
npm install @radix-ui/react-avatar
npm install @radix-ui/react-context-menu
npm install @radix-ui/react-scroll-area
```

---

## Dialog (Modal)

### Basico
```typescript
'use client';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

export function Modal({
  trigger,
  title,
  children
}: {
  trigger: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        {trigger}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="
          fixed inset-0
          bg-black/50
          data-[state=open]:animate-fade-in
          data-[state=closed]:animate-fade-out
        " />
        <Dialog.Content className="
          fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
          w-full max-w-md
          bg-white dark:bg-gray-900
          rounded-lg shadow-xl
          p-6
          data-[state=open]:animate-scale-in
          data-[state=closed]:animate-scale-out
        ">
          <Dialog.Title className="text-lg font-semibold">
            {title}
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-gray-600 dark:text-gray-400">
            {children}
          </Dialog.Description>
          <Dialog.Close asChild>
            <button
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              aria-label="Fechar"
            >
              <X size={20} />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

### Controlado
```typescript
'use client';
import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';

export function ControlledDialog() {
  const [open, setOpen] = useState(false);

  const handleSubmit = async () => {
    await saveData();
    setOpen(false); // Fecha apos salvar
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button>Abrir</button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content>
          <form onSubmit={handleSubmit}>
            {/* Formulario */}
            <button type="submit">Salvar</button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

---

## Dropdown Menu

```typescript
'use client';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { MoreHorizontal, Edit, Trash, Copy } from 'lucide-react';

export function ActionsMenu({
  onEdit,
  onDelete,
  onDuplicate
}: {
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          aria-label="Acoes"
        >
          <MoreHorizontal size={20} />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="
            min-w-[180px]
            bg-white dark:bg-gray-900
            border border-gray-200 dark:border-gray-700
            rounded-lg shadow-lg
            p-1
            animate-slide-down
          "
          sideOffset={5}
        >
          <DropdownMenu.Item
            className="
              flex items-center gap-2
              px-3 py-2
              text-sm
              rounded-md
              cursor-pointer
              outline-none
              hover:bg-gray-100 dark:hover:bg-gray-800
              focus:bg-gray-100 dark:focus:bg-gray-800
            "
            onSelect={onEdit}
          >
            <Edit size={16} />
            Editar
          </DropdownMenu.Item>

          <DropdownMenu.Item
            className="
              flex items-center gap-2
              px-3 py-2
              text-sm
              rounded-md
              cursor-pointer
              outline-none
              hover:bg-gray-100 dark:hover:bg-gray-800
            "
            onSelect={onDuplicate}
          >
            <Copy size={16} />
            Duplicar
          </DropdownMenu.Item>

          <DropdownMenu.Separator className="h-px my-1 bg-gray-200 dark:bg-gray-700" />

          <DropdownMenu.Item
            className="
              flex items-center gap-2
              px-3 py-2
              text-sm text-red-600
              rounded-md
              cursor-pointer
              outline-none
              hover:bg-red-50 dark:hover:bg-red-900/20
            "
            onSelect={onDelete}
          >
            <Trash size={16} />
            Excluir
          </DropdownMenu.Item>

          <DropdownMenu.Arrow className="fill-white dark:fill-gray-900" />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
```

### Sub-menus
```typescript
<DropdownMenu.Sub>
  <DropdownMenu.SubTrigger className="...">
    Mover para
    <ChevronRight size={16} />
  </DropdownMenu.SubTrigger>
  <DropdownMenu.Portal>
    <DropdownMenu.SubContent className="...">
      <DropdownMenu.Item>Pasta 1</DropdownMenu.Item>
      <DropdownMenu.Item>Pasta 2</DropdownMenu.Item>
    </DropdownMenu.SubContent>
  </DropdownMenu.Portal>
</DropdownMenu.Sub>
```

---

## Select

```typescript
'use client';
import * as Select from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

export function SelectField({
  value,
  onValueChange,
  options,
  placeholder = 'Selecione...',
}: {
  value?: string;
  onValueChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
}) {
  return (
    <Select.Root value={value} onValueChange={onValueChange}>
      <Select.Trigger
        className="
          inline-flex items-center justify-between
          w-full px-3 py-2
          text-sm
          bg-white dark:bg-gray-800
          border border-gray-300 dark:border-gray-600
          rounded-lg
          outline-none
          focus:ring-2 focus:ring-blue-500
          data-[placeholder]:text-gray-500
        "
      >
        <Select.Value placeholder={placeholder} />
        <Select.Icon>
          <ChevronDown size={16} />
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Content
          className="
            overflow-hidden
            bg-white dark:bg-gray-800
            border border-gray-200 dark:border-gray-700
            rounded-lg shadow-lg
          "
          position="popper"
          sideOffset={5}
        >
          <Select.ScrollUpButton className="flex items-center justify-center h-6 bg-white dark:bg-gray-800">
            <ChevronUp size={16} />
          </Select.ScrollUpButton>

          <Select.Viewport className="p-1">
            {options.map((option) => (
              <Select.Item
                key={option.value}
                value={option.value}
                className="
                  relative flex items-center
                  px-8 py-2
                  text-sm
                  rounded-md
                  cursor-pointer
                  outline-none
                  select-none
                  data-[highlighted]:bg-blue-100 dark:data-[highlighted]:bg-blue-900
                  data-[disabled]:opacity-50
                "
              >
                <Select.ItemText>{option.label}</Select.ItemText>
                <Select.ItemIndicator className="absolute left-2">
                  <Check size={16} />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>

          <Select.ScrollDownButton className="flex items-center justify-center h-6">
            <ChevronDown size={16} />
          </Select.ScrollDownButton>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
```

---

## Tabs

```typescript
'use client';
import * as Tabs from '@radix-ui/react-tabs';

interface Tab {
  value: string;
  label: string;
  content: React.ReactNode;
}

export function TabsComponent({
  tabs,
  defaultValue
}: {
  tabs: Tab[];
  defaultValue?: string;
}) {
  return (
    <Tabs.Root defaultValue={defaultValue || tabs[0]?.value}>
      <Tabs.List
        className="
          flex
          border-b border-gray-200 dark:border-gray-700
        "
      >
        {tabs.map((tab) => (
          <Tabs.Trigger
            key={tab.value}
            value={tab.value}
            className="
              px-4 py-2
              text-sm font-medium
              text-gray-600 dark:text-gray-400
              border-b-2 border-transparent
              transition-colors
              hover:text-gray-900 dark:hover:text-gray-200
              data-[state=active]:text-blue-600
              data-[state=active]:border-blue-600
            "
          >
            {tab.label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>

      {tabs.map((tab) => (
        <Tabs.Content
          key={tab.value}
          value={tab.value}
          className="
            py-4
            outline-none
            focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
          "
        >
          {tab.content}
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
}
```

---

## Toast (Notificacoes)

```typescript
'use client';
import * as Toast from '@radix-ui/react-toast';
import { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
}

const ToastContext = createContext<{
  toast: (type: ToastType, title: string, description?: string) => void;
} | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback((type: ToastType, title: string, description?: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, type, title, description }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const icons = {
    success: <CheckCircle className="text-green-500" size={20} />,
    error: <AlertCircle className="text-red-500" size={20} />,
    info: <Info className="text-blue-500" size={20} />,
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      <Toast.Provider swipeDirection="right">
        {children}

        {toasts.map((item) => (
          <Toast.Root
            key={item.id}
            open={true}
            onOpenChange={(open) => !open && removeToast(item.id)}
            className="
              flex items-start gap-3
              p-4
              bg-white dark:bg-gray-800
              border border-gray-200 dark:border-gray-700
              rounded-lg shadow-lg
              data-[state=open]:animate-slide-in-right
              data-[state=closed]:animate-slide-out-right
              data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)]
              data-[swipe=cancel]:translate-x-0
              data-[swipe=end]:animate-slide-out-right
            "
          >
            {icons[item.type]}
            <div className="flex-1">
              <Toast.Title className="font-medium text-gray-900 dark:text-gray-100">
                {item.title}
              </Toast.Title>
              {item.description && (
                <Toast.Description className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  {item.description}
                </Toast.Description>
              )}
            </div>
            <Toast.Close aria-label="Fechar">
              <X size={16} className="text-gray-400 hover:text-gray-600" />
            </Toast.Close>
          </Toast.Root>
        ))}

        <Toast.Viewport
          className="
            fixed bottom-4 right-4
            flex flex-col gap-2
            w-[380px] max-w-[100vw]
            z-50
            outline-none
          "
        />
      </Toast.Provider>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}
```

---

## Tooltip

```typescript
'use client';
import * as Tooltip from '@radix-ui/react-tooltip';

export function TooltipComponent({
  children,
  content,
  side = 'top',
}: {
  children: React.ReactNode;
  content: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
}) {
  return (
    <Tooltip.Provider delayDuration={200}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          {children}
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side={side}
            sideOffset={5}
            className="
              px-3 py-1.5
              text-sm
              bg-gray-900 dark:bg-gray-100
              text-white dark:text-gray-900
              rounded-md
              shadow-md
              animate-fade-in
              select-none
            "
          >
            {content}
            <Tooltip.Arrow className="fill-gray-900 dark:fill-gray-100" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
```

---

## Popover

```typescript
'use client';
import * as Popover from '@radix-ui/react-popover';
import { X } from 'lucide-react';

export function PopoverComponent({
  trigger,
  children,
}: {
  trigger: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        {trigger}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="
            w-80
            bg-white dark:bg-gray-800
            border border-gray-200 dark:border-gray-700
            rounded-lg shadow-lg
            p-4
            animate-scale-in
          "
          sideOffset={5}
        >
          {children}
          <Popover.Close
            className="
              absolute top-2 right-2
              p-1 rounded-md
              text-gray-400 hover:text-gray-600
              hover:bg-gray-100 dark:hover:bg-gray-700
            "
            aria-label="Fechar"
          >
            <X size={16} />
          </Popover.Close>
          <Popover.Arrow className="fill-white dark:fill-gray-800" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
```

---

## Checkbox

```typescript
'use client';
import * as Checkbox from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';

export function CheckboxField({
  id,
  label,
  checked,
  onCheckedChange,
}: {
  id: string;
  label: string;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox.Root
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="
          flex items-center justify-center
          w-5 h-5
          bg-white dark:bg-gray-800
          border border-gray-300 dark:border-gray-600
          rounded
          data-[state=checked]:bg-blue-500
          data-[state=checked]:border-blue-500
          transition-colors
        "
      >
        <Checkbox.Indicator className="text-white">
          <Check size={14} />
        </Checkbox.Indicator>
      </Checkbox.Root>
      <label
        htmlFor={id}
        className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer"
      >
        {label}
      </label>
    </div>
  );
}
```

---

## Switch

```typescript
'use client';
import * as Switch from '@radix-ui/react-switch';

export function SwitchField({
  id,
  label,
  checked,
  onCheckedChange,
}: {
  id: string;
  label: string;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <label htmlFor={id} className="text-sm text-gray-700 dark:text-gray-300">
        {label}
      </label>
      <Switch.Root
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="
          relative
          w-11 h-6
          bg-gray-200 dark:bg-gray-700
          rounded-full
          transition-colors
          data-[state=checked]:bg-blue-500
        "
      >
        <Switch.Thumb
          className="
            block
            w-5 h-5
            bg-white
            rounded-full
            shadow-md
            transition-transform
            translate-x-0.5
            data-[state=checked]:translate-x-[22px]
          "
        />
      </Switch.Root>
    </div>
  );
}
```

---

## Accordion

```typescript
'use client';
import * as Accordion from '@radix-ui/react-accordion';
import { ChevronDown } from 'lucide-react';

interface AccordionItem {
  value: string;
  trigger: string;
  content: React.ReactNode;
}

export function AccordionComponent({
  items,
  type = 'single',
}: {
  items: AccordionItem[];
  type?: 'single' | 'multiple';
}) {
  return (
    <Accordion.Root
      type={type}
      collapsible={type === 'single'}
      className="
        bg-white dark:bg-gray-800
        border border-gray-200 dark:border-gray-700
        rounded-lg
        divide-y divide-gray-200 dark:divide-gray-700
      "
    >
      {items.map((item) => (
        <Accordion.Item key={item.value} value={item.value}>
          <Accordion.Header>
            <Accordion.Trigger
              className="
                group
                flex items-center justify-between
                w-full px-4 py-3
                text-left text-sm font-medium
                hover:bg-gray-50 dark:hover:bg-gray-700
                transition-colors
              "
            >
              {item.trigger}
              <ChevronDown
                className="
                  text-gray-400
                  transition-transform duration-200
                  group-data-[state=open]:rotate-180
                "
                size={16}
              />
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content
            className="
              overflow-hidden
              data-[state=open]:animate-accordion-down
              data-[state=closed]:animate-accordion-up
            "
          >
            <div className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
              {item.content}
            </div>
          </Accordion.Content>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  );
}
```

---

## Alert Dialog (Confirmacao)

```typescript
'use client';
import * as AlertDialog from '@radix-ui/react-alert-dialog';

export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  onConfirm,
  variant = 'danger',
}: {
  trigger: React.ReactNode;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  variant?: 'danger' | 'warning';
}) {
  const confirmStyles = {
    danger: 'bg-red-500 hover:bg-red-600 text-white',
    warning: 'bg-yellow-500 hover:bg-yellow-600 text-white',
  };

  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger asChild>
        {trigger}
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-black/50" />
        <AlertDialog.Content
          className="
            fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
            w-full max-w-md
            bg-white dark:bg-gray-900
            rounded-lg shadow-xl
            p-6
          "
        >
          <AlertDialog.Title className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {title}
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-gray-600 dark:text-gray-400">
            {description}
          </AlertDialog.Description>
          <div className="flex justify-end gap-3 mt-6">
            <AlertDialog.Cancel asChild>
              <button
                className="
                  px-4 py-2
                  text-sm font-medium
                  text-gray-700 dark:text-gray-300
                  bg-gray-100 dark:bg-gray-800
                  rounded-lg
                  hover:bg-gray-200 dark:hover:bg-gray-700
                "
              >
                {cancelLabel}
              </button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <button
                onClick={onConfirm}
                className={`
                  px-4 py-2
                  text-sm font-medium
                  rounded-lg
                  ${confirmStyles[variant]}
                `}
              >
                {confirmLabel}
              </button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
```

---

## Scroll Area

```typescript
'use client';
import * as ScrollArea from '@radix-ui/react-scroll-area';

export function ScrollAreaComponent({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <ScrollArea.Root className={`overflow-hidden ${className}`}>
      <ScrollArea.Viewport className="w-full h-full rounded">
        {children}
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar
        orientation="vertical"
        className="
          flex select-none touch-none
          p-0.5
          bg-gray-100 dark:bg-gray-800
          transition-colors
          hover:bg-gray-200 dark:hover:bg-gray-700
          w-2.5
        "
      >
        <ScrollArea.Thumb
          className="
            flex-1
            bg-gray-400 dark:bg-gray-600
            rounded-full
            relative
            before:content-['']
            before:absolute
            before:top-1/2 before:left-1/2
            before:-translate-x-1/2 before:-translate-y-1/2
            before:w-full before:h-full
            before:min-w-[44px] before:min-h-[44px]
          "
        />
      </ScrollArea.Scrollbar>
      <ScrollArea.Scrollbar
        orientation="horizontal"
        className="
          flex select-none touch-none flex-col
          p-0.5
          bg-gray-100 dark:bg-gray-800
          h-2.5
        "
      >
        <ScrollArea.Thumb className="flex-1 bg-gray-400 dark:bg-gray-600 rounded-full" />
      </ScrollArea.Scrollbar>
      <ScrollArea.Corner className="bg-gray-100 dark:bg-gray-800" />
    </ScrollArea.Root>
  );
}
```

---

## Avatar

```typescript
'use client';
import * as Avatar from '@radix-ui/react-avatar';

export function AvatarComponent({
  src,
  alt,
  fallback,
  size = 'md',
}: {
  src?: string;
  alt: string;
  fallback: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizes = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
  };

  return (
    <Avatar.Root
      className={`
        inline-flex items-center justify-center
        overflow-hidden
        rounded-full
        bg-gray-200 dark:bg-gray-700
        ${sizes[size]}
      `}
    >
      <Avatar.Image
        src={src}
        alt={alt}
        className="w-full h-full object-cover"
      />
      <Avatar.Fallback
        className="
          flex items-center justify-center
          w-full h-full
          font-medium
          text-gray-600 dark:text-gray-300
          bg-gray-200 dark:bg-gray-700
        "
        delayMs={600}
      >
        {fallback}
      </Avatar.Fallback>
    </Avatar.Root>
  );
}
```

---

## Slider

```typescript
'use client';
import * as Slider from '@radix-ui/react-slider';

export function SliderComponent({
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  label,
}: {
  value: number[];
  onValueChange: (value: number[]) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
}) {
  return (
    <div className="space-y-2">
      {label && (
        <div className="flex justify-between text-sm">
          <span className="text-gray-700 dark:text-gray-300">{label}</span>
          <span className="text-gray-500">{value[0]}</span>
        </div>
      )}
      <Slider.Root
        value={value}
        onValueChange={onValueChange}
        min={min}
        max={max}
        step={step}
        className="
          relative flex items-center
          select-none touch-none
          w-full h-5
        "
      >
        <Slider.Track
          className="
            relative flex-grow
            h-1.5
            bg-gray-200 dark:bg-gray-700
            rounded-full
          "
        >
          <Slider.Range
            className="
              absolute
              h-full
              bg-blue-500
              rounded-full
            "
          />
        </Slider.Track>
        <Slider.Thumb
          className="
            block
            w-5 h-5
            bg-white
            border-2 border-blue-500
            rounded-full
            shadow-md
            hover:bg-blue-50
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
          "
        />
      </Slider.Root>
    </div>
  );
}
```

---

## Context Menu (Clique Direito)

```typescript
'use client';
import * as ContextMenu from '@radix-ui/react-context-menu';

export function ContextMenuComponent({
  children,
  items,
}: {
  children: React.ReactNode;
  items: Array<{
    label: string;
    icon?: React.ReactNode;
    onSelect: () => void;
    destructive?: boolean;
  }>;
}) {
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        {children}
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content
          className="
            min-w-[180px]
            bg-white dark:bg-gray-900
            border border-gray-200 dark:border-gray-700
            rounded-lg shadow-lg
            p-1
            animate-scale-in
          "
        >
          {items.map((item, index) => (
            <ContextMenu.Item
              key={index}
              onSelect={item.onSelect}
              className={`
                flex items-center gap-2
                px-3 py-2
                text-sm
                rounded-md
                cursor-pointer
                outline-none
                ${item.destructive
                  ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                }
              `}
            >
              {item.icon}
              {item.label}
            </ContextMenu.Item>
          ))}
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
```

---

## Animacoes CSS para Radix

Adicione ao seu CSS global ou tailwind.config.js:

```css
/* globals.css */
@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes fade-out {
  from { opacity: 1; }
  to { opacity: 0; }
}

@keyframes scale-in {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes scale-out {
  from { opacity: 1; transform: scale(1); }
  to { opacity: 0; transform: scale(0.95); }
}

@keyframes slide-down {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes slide-in-right {
  from { opacity: 0; transform: translateX(100%); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes slide-out-right {
  from { opacity: 1; transform: translateX(0); }
  to { opacity: 0; transform: translateX(100%); }
}

@keyframes accordion-down {
  from { height: 0; }
  to { height: var(--radix-accordion-content-height); }
}

@keyframes accordion-up {
  from { height: var(--radix-accordion-content-height); }
  to { height: 0; }
}

.animate-fade-in { animation: fade-in 150ms ease-out; }
.animate-fade-out { animation: fade-out 150ms ease-in; }
.animate-scale-in { animation: scale-in 150ms ease-out; }
.animate-scale-out { animation: scale-out 150ms ease-in; }
.animate-slide-down { animation: slide-down 150ms ease-out; }
.animate-slide-in-right { animation: slide-in-right 150ms ease-out; }
.animate-slide-out-right { animation: slide-out-right 150ms ease-out; }
.animate-accordion-down { animation: accordion-down 200ms ease-out; }
.animate-accordion-up { animation: accordion-up 200ms ease-out; }
```

---

## Padroes de Composicao

### Pattern: asChild
```typescript
// Permite usar seu proprio componente como trigger
<Dialog.Trigger asChild>
  <Button variant="primary">Abrir Modal</Button>
</Dialog.Trigger>

// Sem asChild - renderiza <button> padrao
<Dialog.Trigger>Abrir Modal</Dialog.Trigger>
```

### Pattern: Controlled vs Uncontrolled
```typescript
// Uncontrolled (estado interno)
<Dialog.Root>
  ...
</Dialog.Root>

// Controlled (voce controla o estado)
<Dialog.Root open={open} onOpenChange={setOpen}>
  ...
</Dialog.Root>
```

### Pattern: Portal
```typescript
// Renderiza fora da arvore DOM
<Dialog.Portal>
  <Dialog.Overlay />
  <Dialog.Content>...</Dialog.Content>
</Dialog.Portal>

// Renderiza em container especifico
<Dialog.Portal container={customContainer}>
  ...
</Dialog.Portal>
```

---

## Checklist de Boas Praticas

- [ ] Usar `asChild` para compor com seus componentes
- [ ] Incluir animacoes para transicoes
- [ ] Implementar estados de foco visiveis
- [ ] Usar Portal para modais/dropdowns
- [ ] Testar navegacao por teclado
- [ ] Incluir aria-labels apropriados
- [ ] Suportar dark mode em todos componentes
- [ ] Usar data-state para estilizacao condicional
