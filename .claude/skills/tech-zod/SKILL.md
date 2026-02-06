---
name: tech-zod
description: Melhores praticas Zod - Validacao, Schemas, Inferencia de Tipos, Transformacoes
version: 1.0.0
---

# Zod - Melhores Praticas

## Introducao

Zod e uma biblioteca de validacao TypeScript-first com inferencia de tipos automatica.

```typescript
import { z } from 'zod';

// Define schema
const UserSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  age: z.number().min(0),
});

// Infere tipo automaticamente
type User = z.infer<typeof UserSchema>;
// { name: string; email: string; age: number }

// Valida dados
const user = UserSchema.parse(data); // Lanca erro se invalido
const result = UserSchema.safeParse(data); // Retorna { success, data/error }
```

---

## Tipos Primitivos

```typescript
// Strings
z.string()
z.string().min(1)                    // Minimo 1 caractere
z.string().max(100)                  // Maximo 100 caracteres
z.string().length(10)                // Exatamente 10 caracteres
z.string().email()                   // Email valido
z.string().url()                     // URL valida
z.string().uuid()                    // UUID valido
z.string().regex(/^[a-z]+$/)         // Regex customizado
z.string().trim()                    // Remove espacos
z.string().toLowerCase()             // Converte para minusculas
z.string().toUpperCase()             // Converte para maiusculas

// Numeros
z.number()
z.number().min(0)                    // Minimo 0
z.number().max(100)                  // Maximo 100
z.number().int()                     // Inteiro
z.number().positive()                // Positivo
z.number().negative()                // Negativo
z.number().nonnegative()             // >= 0
z.number().finite()                  // Finito

// Booleans
z.boolean()

// Dates
z.date()
z.date().min(new Date('2020-01-01'))
z.date().max(new Date())

// Coercion (converte automaticamente)
z.coerce.string()                    // Converte para string
z.coerce.number()                    // Converte para number
z.coerce.boolean()                   // Converte para boolean
z.coerce.date()                      // Converte para Date
```

---

## Objetos

```typescript
// Objeto basico
const UserSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  age: z.number().optional(),
});

// Strict (rejeita campos extras)
const StrictUser = z.object({
  name: z.string(),
}).strict();

// Passthrough (permite campos extras)
const FlexibleUser = z.object({
  name: z.string(),
}).passthrough();

// Partial (todos opcionais)
const PartialUser = UserSchema.partial();
// { name?: string; email?: string; age?: number }

// Required (todos obrigatorios)
const RequiredUser = UserSchema.partial().required();

// Pick (seleciona campos)
const UserName = UserSchema.pick({ name: true });
// { name: string }

// Omit (remove campos)
const UserWithoutAge = UserSchema.omit({ age: true });
// { name: string; email: string }

// Extend (adiciona campos)
const ExtendedUser = UserSchema.extend({
  role: z.enum(['admin', 'user']),
});

// Merge (combina schemas)
const AddressSchema = z.object({
  street: z.string(),
  city: z.string(),
});

const UserWithAddress = UserSchema.merge(AddressSchema);
```

---

## Arrays e Tuplas

```typescript
// Array
z.array(z.string())                  // string[]
z.array(z.number()).min(1)           // Minimo 1 elemento
z.array(z.number()).max(10)          // Maximo 10 elementos
z.array(z.number()).length(5)        // Exatamente 5 elementos
z.array(z.number()).nonempty()       // Pelo menos 1 elemento

// Tupla
z.tuple([z.string(), z.number()])    // [string, number]
z.tuple([z.string(), z.number()]).rest(z.boolean())
// [string, number, ...boolean[]]
```

---

## Unions e Enums

```typescript
// Union
z.union([z.string(), z.number()])    // string | number
z.string().or(z.number())            // Alternativa

// Literal
z.literal('pending')                 // Exatamente "pending"
z.literal(42)                        // Exatamente 42

// Enum
z.enum(['pending', 'active', 'done'])
// "pending" | "active" | "done"

// Native Enum
enum Status {
  Pending = 'pending',
  Active = 'active',
  Done = 'done',
}
z.nativeEnum(Status)

// Discriminated Union (melhor performance)
const EventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('click'), x: z.number(), y: z.number() }),
  z.object({ type: z.literal('scroll'), offset: z.number() }),
  z.object({ type: z.literal('keypress'), key: z.string() }),
]);
```

---

## Optional, Nullable, Default

```typescript
// Optional (undefined permitido)
z.string().optional()                // string | undefined

// Nullable (null permitido)
z.string().nullable()                // string | null

// Nullish (null ou undefined)
z.string().nullish()                 // string | null | undefined

// Default
z.string().default('default')        // Se undefined, usa "default"
z.number().default(() => Date.now()) // Default dinamico

// Catch (valor se parsing falhar)
z.string().catch('fallback')         // Se invalido, usa "fallback"
```

---

## Refinements e Transforms

### Refinements (Validacoes customizadas)
```typescript
// Refine simples
const PasswordSchema = z.string()
  .min(8, 'Minimo 8 caracteres')
  .refine(
    (val) => /[A-Z]/.test(val),
    { message: 'Deve conter letra maiuscula' }
  )
  .refine(
    (val) => /[0-9]/.test(val),
    { message: 'Deve conter numero' }
  );

// SuperRefine (acesso ao contexto)
const FormSchema = z.object({
  password: z.string(),
  confirmPassword: z.string(),
}).superRefine((data, ctx) => {
  if (data.password !== data.confirmPassword) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Senhas nao conferem',
      path: ['confirmPassword'],
    });
  }
});
```

### Transforms (Transformacoes)
```typescript
// Transform simples
const TrimmedString = z.string().transform((val) => val.trim());

// Transform com validacao
const NumberString = z.string()
  .transform((val) => parseInt(val, 10))
  .refine((val) => !isNaN(val), 'Deve ser um numero');

// Preprocess (antes da validacao)
const CoercedNumber = z.preprocess(
  (val) => (typeof val === 'string' ? parseInt(val, 10) : val),
  z.number()
);
```

---

## Schemas do Projeto CRM

### User Schema
```typescript
export const createUserSchema = z.object({
  name: z.string()
    .min(2, 'Nome deve ter no minimo 2 caracteres')
    .max(100, 'Nome deve ter no maximo 100 caracteres'),
  email: z.string()
    .email('Email invalido')
    .toLowerCase(),
  password: z.string()
    .min(8, 'Senha deve ter no minimo 8 caracteres')
    .regex(/[A-Z]/, 'Senha deve conter letra maiuscula')
    .regex(/[0-9]/, 'Senha deve conter numero'),
  role: z.enum(['ADMIN', 'ATTENDANT', 'SALES']).default('ATTENDANT'),
});

export const updateUserSchema = createUserSchema
  .partial()
  .omit({ password: true });

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
```

### Contact Schema
```typescript
export const createContactSchema = z.object({
  name: z.string().min(1).max(100),
  phone: z.string()
    .regex(/^\d{10,15}$/, 'Telefone invalido'),
  email: z.string().email().optional(),
  tags: z.array(z.string().uuid()).default([]),
  metadata: z.record(z.unknown()).default({}),
});
```

### Conversation Schema
```typescript
export const conversationStatusSchema = z.enum([
  'PENDING',
  'OPEN',
  'RESOLVED',
  'CLOSED',
]);

export const updateConversationSchema = z.object({
  status: conversationStatusSchema.optional(),
  assignedToId: z.string().uuid().nullable().optional(),
  iaLocked: z.boolean().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  tags: z.array(z.string().uuid()).optional(),
});
```

### Pagination Schema
```typescript
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type PaginationInput = z.infer<typeof paginationSchema>;
```

### Filter Schema
```typescript
export const conversationFilterSchema = paginationSchema.extend({
  status: conversationStatusSchema.optional(),
  assignedToId: z.string().uuid().optional(),
  isOpportunity: z.coerce.boolean().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  search: z.string().optional(),
});
```

---

## Integracao com Express

### Middleware de Validacao
```typescript
import { z, ZodSchema } from 'zod';
import { Request, Response, NextFunction } from 'express';

export const validate = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Dados invalidos',
          details: result.error.errors.map((err) => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        },
      });
    }

    req.body = result.data;
    next();
  };
};

// Uso
router.post('/users', validate(createUserSchema), createUser);
```

### Validacao de Query Params
```typescript
export const validateQuery = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Query params invalidos',
          details: result.error.errors,
        },
      });
    }

    req.query = result.data;
    next();
  };
};

// Uso
router.get('/conversations', validateQuery(conversationFilterSchema), list);
```

---

## Error Handling

### Customizar mensagens
```typescript
const schema = z.object({
  name: z.string({
    required_error: 'Nome e obrigatorio',
    invalid_type_error: 'Nome deve ser texto',
  }).min(2, { message: 'Nome muito curto' }),

  email: z.string()
    .email({ message: 'Email invalido' }),

  age: z.number({
    required_error: 'Idade e obrigatoria',
  }).min(18, { message: 'Deve ser maior de 18 anos' }),
});
```

### Formatar erros
```typescript
const formatZodErrors = (error: z.ZodError) => {
  return error.errors.map((err) => ({
    field: err.path.join('.'),
    message: err.message,
    code: err.code,
  }));
};

// Uso
const result = schema.safeParse(data);
if (!result.success) {
  const errors = formatZodErrors(result.error);
  // [{ field: 'email', message: 'Email invalido', code: 'invalid_string' }]
}
```

---

## Checklist de Boas Praticas

- [ ] Usar `z.infer` para inferir tipos
- [ ] Usar `.safeParse()` em vez de `.parse()` para evitar exceptions
- [ ] Criar schemas reutilizaveis (base, create, update)
- [ ] Usar `.strict()` para rejeitar campos extras
- [ ] Adicionar mensagens de erro customizadas
- [ ] Usar `z.coerce` para converter tipos automaticamente
- [ ] Usar discriminated unions para melhor performance
- [ ] Exportar types junto com schemas
- [ ] Validar query params e body separadamente
- [ ] Usar refinements para validacoes complexas
