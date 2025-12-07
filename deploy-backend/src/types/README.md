# Type Definitions

This directory contains TypeScript type definitions for type-safe backend development.

## Files

### `whatsapp.types.ts`
Type-safe definitions for WhatsApp Business Cloud API.

**Usage:**
```typescript
import {
  WhatsAppWebhookPayload,
  WhatsAppIncomingMessage,
  WhatsAppTextMessageRequest,
  isWhatsAppWebhookPayload,
  isTextMessage,
} from '@types/whatsapp.types';

// Webhook handler
function handleWebhook(payload: unknown) {
  if (!isWhatsAppWebhookPayload(payload)) {
    throw new Error('Invalid webhook payload');
  }

  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      const messages = change.value.messages;
      if (messages) {
        for (const message of messages) {
          if (isTextMessage(message)) {
            console.log('Text:', message.text.body);
          }
        }
      }
    }
  }
}

// Send text message
const request: WhatsAppTextMessageRequest = {
  messaging_product: 'whatsapp',
  to: '5511999999999',
  type: 'text',
  text: {
    body: 'Hello World',
    preview_url: false,
  },
};
```

### `utility.types.ts`
Reusable utility types for common patterns.

**Usage:**
```typescript
import {
  Result,
  AsyncResult,
  Maybe,
  PaginatedResult,
  ApiResponse,
  isSuccess,
  isError,
} from '@types/utility.types';

// Result type for error handling
function divide(a: number, b: number): Result<number, string> {
  if (b === 0) {
    return { success: false, error: 'Division by zero' };
  }
  return { success: true, data: a / b };
}

const result = divide(10, 2);
if (isSuccess(result)) {
  console.log('Result:', result.data); // Type is number
} else {
  console.error('Error:', result.error); // Type is string
}

// AsyncResult for async operations
async function fetchUser(id: string): AsyncResult<User, ApiError> {
  try {
    const user = await db.user.findUnique({ where: { id } });
    if (!user) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found', statusCode: 404 },
      };
    }
    return { success: true, data: user };
  } catch (error) {
    return {
      success: false,
      error: { code: 'DB_ERROR', message: 'Database error', statusCode: 500 },
    };
  }
}

// Paginated responses
async function getUsers(params: PaginationParams): Promise<PaginatedResult<User>> {
  const [data, total] = await Promise.all([
    db.user.findMany({
      skip: (params.page - 1) * params.limit,
      take: params.limit,
    }),
    db.user.count(),
  ]);

  return {
    data,
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages: Math.ceil(total / params.limit),
      hasPreviousPage: params.page > 1,
      hasNextPage: params.page < Math.ceil(total / params.limit),
    },
  };
}

// API responses
function successResponse<T>(data: T): ApiResponse<T> {
  return {
    success: true,
    data,
    message: 'Operation successful',
  };
}

function errorResponse(code: string, message: string): ApiErrorResponse {
  return {
    success: false,
    error: {
      code,
      message,
      statusCode: 400,
    },
  };
}
```

### `express.d.ts`
Express Request augmentation for tenant and user context.

**Usage:**
```typescript
import { Request, Response } from 'express';

// Middleware automatically sets req.tenant and req.user
function handler(req: Request, res: Response) {
  // TypeScript knows these properties exist
  const tenantId = req.tenant?.id;
  const userId = req.user?.id;

  if (!tenantId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Type-safe access
  console.log('Tenant:', req.tenant.name);
  console.log('User:', req.user?.email);
}
```

## Best Practices

### 1. Use Type Guards
Always use type guards for runtime type checking:
```typescript
if (isTextMessage(message)) {
  // TypeScript knows message is WhatsAppTextMessageIncoming
  console.log(message.text.body);
}
```

### 2. Use Result Types for Error Handling
Prefer `Result<T, E>` over throwing exceptions:
```typescript
// Good
function parse(value: string): Result<number, string> {
  const num = parseInt(value);
  if (isNaN(num)) {
    return { success: false, error: 'Invalid number' };
  }
  return { success: true, data: num };
}

// Avoid
function parse(value: string): number {
  const num = parseInt(value);
  if (isNaN(num)) {
    throw new Error('Invalid number'); // Hard to track in types
  }
  return num;
}
```

### 3. Use Utility Types
Leverage utility types for common patterns:
```typescript
// Make some fields optional
type UserUpdate = OptionalKeys<User, 'email' | 'name'>;

// Deep partial for complex objects
type PartialConfig = DeepPartial<Config>;

// Require specific fields
type UserWithId = RequireKeys<User, 'id'>;
```

### 4. Use Discriminated Unions
Use discriminated unions for type-safe handling:
```typescript
// WhatsAppIncomingMessage is a discriminated union
function handleMessage(message: WhatsAppIncomingMessage) {
  switch (message.type) {
    case 'text':
      // TypeScript knows this is WhatsAppTextMessageIncoming
      console.log(message.text.body);
      break;
    case 'image':
      // TypeScript knows this is WhatsAppImageMessageIncoming
      console.log(message.image.id);
      break;
    // ...
  }
}
```

### 5. Avoid `any`
Never use `any`. Use `unknown` or `JSONValue` instead:
```typescript
// Bad
function handle(data: any) { }

// Good
function handle(data: unknown) {
  if (typeof data === 'string') {
    // TypeScript knows data is string
  }
}

// Good for JSON
function handle(data: JSONValue) {
  // TypeScript ensures it's valid JSON
}
```

## Type Safety Checklist

- [ ] All functions have explicit return types
- [ ] No use of `any` (use `unknown` or specific types)
- [ ] No use of `Record<string, any>` (use specific metadata types)
- [ ] Type guards used for runtime checks
- [ ] Discriminated unions for polymorphic data
- [ ] Result types for error handling
- [ ] Proper use of `Maybe`, `Nullable`, `Optional`
- [ ] No unchecked indexed access (use `noUncheckedIndexedAccess`)
- [ ] No implicit returns (use `noImplicitReturns`)

## Migration Guide

### Replace `Record<string, any>`
```typescript
// Before
interface Message {
  metadata?: Record<string, any>;
}

// After
import { MessageMetadata } from '@types/metadata.types';
interface Message {
  metadata?: MessageMetadata;
}
```

### Replace `any` with Result types
```typescript
// Before
async function fetchData(): Promise<any> {
  // ...
}

// After
async function fetchData(): AsyncResult<Data, Error> {
  try {
    const data = await api.get('/data');
    return { success: true, data };
  } catch (error) {
    return { success: false, error };
  }
}
```

### Use Type Guards
```typescript
// Before
function handle(webhook: any) {
  if (webhook.object === 'whatsapp_business_account') {
    // Unsafe
  }
}

// After
function handle(webhook: unknown) {
  if (isWhatsAppWebhookPayload(webhook)) {
    // Type-safe
    webhook.entry.forEach(entry => {
      // TypeScript knows the structure
    });
  }
}
```
