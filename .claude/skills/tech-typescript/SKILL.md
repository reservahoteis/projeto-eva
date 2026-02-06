---
name: tech-typescript
description: Melhores praticas TypeScript - Tipos Avancados, Generics, Utility Types, Type Guards
version: 1.0.0
---

# TypeScript - Melhores Praticas

## Tipos Basicos

```typescript
// Primitivos
let nome: string = 'Maria';
let idade: number = 25;
let ativo: boolean = true;

// Arrays e Tuplas
let numeros: number[] = [1, 2, 3];
let pessoa: [string, number] = ['Ana', 25];

// Unknown vs Any
let desconhecido: unknown = 'mais seguro'; // Preferir
let qualquer: any = 'evitar';              // Evitar
```

---

## Interfaces vs Types

```typescript
// Interface - objetos e classes
interface User {
  id: string;
  name: string;
  email: string;
}

interface Admin extends User {
  permissions: string[];
}

// Type - unions, intersections, mapped types
type ID = string | number;
type Status = 'PENDING' | 'ACTIVE' | 'DONE';
type AdminUser = User & { permissions: string[] };
```

---

## Generics

```typescript
// Funcao generica
function identity<T>(value: T): T {
  return value;
}

// Com constraint
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

// Interface generica
interface Response<T> {
  success: boolean;
  data: T;
  error?: string;
}

interface PaginatedResponse<T> extends Response<T[]> {
  meta: { total: number; page: number; limit: number };
}

// Classe generica
class Repository<T extends { id: string }> {
  private items = new Map<string, T>();

  create(item: T): T {
    this.items.set(item.id, item);
    return item;
  }

  findById(id: string): T | undefined {
    return this.items.get(id);
  }
}
```

---

## Utility Types

```typescript
interface User {
  id: string;
  name: string;
  email: string;
  password: string;
}

// Partial - todos opcionais
type PartialUser = Partial<User>;

// Required - todos obrigatorios
type RequiredUser = Required<User>;

// Readonly - somente leitura
type ReadonlyUser = Readonly<User>;

// Pick - seleciona
type UserPublic = Pick<User, 'id' | 'name' | 'email'>;

// Omit - remove
type UserWithoutPassword = Omit<User, 'password'>;

// Record - dicionario
type UserMap = Record<string, User>;

// Extract/Exclude
type AllTypes = string | number | boolean;
type Primitives = Extract<AllTypes, string | number>; // string | number
type NonStrings = Exclude<AllTypes, string>;          // number | boolean

// Parameters/ReturnType
function createUser(name: string, email: string) {
  return { name, email };
}
type Params = Parameters<typeof createUser>; // [string, string]
type Result = ReturnType<typeof createUser>; // { name: string; email: string }
```

---

## Conditional Types

```typescript
// Basico
type IsString<T> = T extends string ? true : false;

// Infer
type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;
type ArrayElement<T> = T extends (infer U)[] ? U : never;

// Uso
type X = UnwrapPromise<Promise<string>>; // string
type Y = ArrayElement<number[]>;          // number
```

---

## Mapped Types

```typescript
// Transformar propriedades
type Nullable<T> = { [K in keyof T]: T[K] | null };
type Optional<T> = { [K in keyof T]?: T[K] };

// Modificadores
type Mutable<T> = { -readonly [K in keyof T]: T[K] };
type Concrete<T> = { [K in keyof T]-?: T[K] };

// Renomear chaves
type Getters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K];
};

// Filtrar
type OnlyStrings<T> = {
  [K in keyof T as T[K] extends string ? K : never]: T[K];
};
```

---

## Type Guards

```typescript
// typeof e instanceof
function process(value: string | number) {
  if (typeof value === 'string') {
    return value.toUpperCase();
  }
  return value.toFixed(2);
}

// in operator
interface Dog { bark(): void }
interface Cat { meow(): void }

function speak(animal: Dog | Cat) {
  if ('bark' in animal) animal.bark();
  else animal.meow();
}

// Custom type guard
function isUser(obj: unknown): obj is User {
  return typeof obj === 'object' && obj !== null && 'id' in obj && 'email' in obj;
}

// Assertion function
function assertIsString(value: unknown): asserts value is string {
  if (typeof value !== 'string') throw new Error('Not a string');
}
```

---

## Discriminated Unions

```typescript
interface LoadingState { status: 'loading' }
interface SuccessState<T> { status: 'success'; data: T }
interface ErrorState { status: 'error'; error: string }

type AsyncState<T> = LoadingState | SuccessState<T> | ErrorState;

function render<T>(state: AsyncState<T>) {
  switch (state.status) {
    case 'loading': return 'Carregando...';
    case 'success': return `Data: ${state.data}`;
    case 'error': return `Erro: ${state.error}`;
  }
}

// Exhaustive check
function assertNever(value: never): never {
  throw new Error(`Unexpected: ${value}`);
}
```

---

## Template Literal Types

```typescript
type EventName = 'click' | 'focus' | 'blur';
type EventHandler = `on${Capitalize<EventName>}`;
// 'onClick' | 'onFocus' | 'onBlur'

type Color = 'red' | 'blue';
type Size = 'sm' | 'lg';
type Variant = `${Color}-${Size}`;
// 'red-sm' | 'red-lg' | 'blue-sm' | 'blue-lg'
```

---

## Declaration Merging

```typescript
// Estender Express
declare module 'express' {
  interface Request {
    userId?: string;
    tenantId?: string;
  }
}

// Estender Window
declare global {
  interface Window {
    analytics: { track: (event: string) => void };
  }
}

// Modulos sem tipos
declare module 'untyped-lib' {
  export function doSomething(value: string): number;
}

// Assets
declare module '*.png' {
  const src: string;
  export default src;
}
```

---

## Patterns do Projeto

```typescript
// API Response
interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: { code: string; message: string };
}

interface PaginatedData<T> {
  items: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

type ApiPaginatedResponse<T> = ApiResponse<PaginatedData<T>>;

// Form Types
type CreateUserInput = Omit<User, 'id' | 'createdAt' | 'updatedAt'>;
type UpdateUserInput = Partial<CreateUserInput>;

// Event Emitter Tipado
type Events = {
  'user:login': { userId: string };
  'message:new': { content: string };
};

class TypedEmitter<T extends Record<string, any>> {
  private listeners = new Map<keyof T, Set<Function>>();

  on<K extends keyof T>(event: K, fn: (data: T[K]) => void) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(fn);
  }

  emit<K extends keyof T>(event: K, data: T[K]) {
    this.listeners.get(event)?.forEach(fn => fn(data));
  }
}
```

---

## tsconfig.json Recomendado

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noUncheckedIndexedAccess": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "target": "ES2022",
    "lib": ["ES2022", "DOM"],
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  }
}
```

---

## Checklist

- [ ] Usar `strict: true`
- [ ] Preferir `unknown` sobre `any`
- [ ] Usar type guards para narrowing
- [ ] Usar discriminated unions para estados
- [ ] Criar utility types reutilizaveis
- [ ] Usar generics para codigo flexivel
- [ ] Exportar tipos junto com implementacoes
- [ ] Usar `as const` para literais imutaveis
