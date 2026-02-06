# TypeScript Strict Mode

## Metadados
- Confidence: 95%
- Learned from: Code reviews
- Last validated: 2025-02-04
- Category: Code Quality

## Regra
**NUNCA usar `any`, `@ts-ignore`, ou `!` (non-null assertion) sem justificativa.**

TypeScript strict mode existe para prevenir bugs em runtime.

## Proibicoes

### 1. Tipo `any`
```typescript
// PROIBIDO
const data: any = response;
function process(input: any) { }

// CORRETO
const data: ApiResponse = response;
function process(input: unknown) {
  if (isValidInput(input)) {
    // agora input tem tipo correto
  }
}
```

### 2. @ts-ignore
```typescript
// PROIBIDO
// @ts-ignore
const result = riskyOperation();

// CORRETO - resolver o problema de tipo
const result = riskyOperation() as ExpectedType;
// ou usar type guard
if (isExpectedType(result)) {
  // ...
}
```

### 3. Non-null Assertion (!)
```typescript
// EVITAR
const name = user!.name;
const first = array![0];

// CORRETO
const name = user?.name ?? 'Unknown';
const first = array?.[0];

// ou com verificacao
if (user) {
  const name = user.name;
}
```

## Alternativas a `any`

| Situacao | Use |
|----------|-----|
| Tipo desconhecido | `unknown` |
| Qualquer objeto | `Record<string, unknown>` |
| Array generico | `unknown[]` |
| Funcao generica | Generics `<T>` |

## Exemplos Praticos

### API Response
```typescript
// CORRETO
interface ApiResponse<T> {
  data: T;
  success: boolean;
  error?: string;
}

async function fetchData<T>(url: string): Promise<ApiResponse<T>> {
  const response = await fetch(url);
  return response.json() as ApiResponse<T>;
}
```

### Event Handlers
```typescript
// CORRETO
function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
  const value = event.target.value;
}

// Para eventos genericos
function handleEvent(event: Event) {
  if (event.target instanceof HTMLInputElement) {
    const value = event.target.value;
  }
}
```

## Validacao Automatica

O hook `validate-typescript.js` executa `tsc --noEmit` apos cada edicao de arquivo `.ts` ou `.tsx`.

## Quando `any` e Aceitavel

Raramente, mas se necessario, documente:

```typescript
// TODO: Tipar corretamente quando API for estabilizada
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const legacyData: any = externalApi.getData();
```
