# Frontend Type Definitions

This directory contains TypeScript type definitions for type-safe frontend development.

## Files

### `index.ts`
Main type exports for the application (User, Tenant, Contact, Conversation, Message, etc.).

### `metadata.ts`
Type-safe metadata structures replacing generic `Record<string, any>`.

**Available Types:**
- `ContactMetadata` - Contact metadata
- `MessageMetadata` - Message metadata
- `ConversationMetadata` - Conversation metadata

### `utility.ts`
Common utility types for frontend development.

**Available Types:**
- `Nullable<T>` - T | null
- `Optional<T>` - T | undefined
- `Maybe<T>` - T | null | undefined
- `ISODateString` - ISO 8601 date string
- `JSONValue` - Type-safe JSON values
- `DeepPartial<T>` - Deep partial objects
- `DeepReadonly<T>` - Deep readonly objects

## Usage Examples

### Contact Metadata

```typescript
import { Contact, ContactMetadata } from '@/types';

const contact: Contact = {
  id: '1',
  tenantId: 'tenant-1',
  phoneNumber: '+5511999999999',
  name: 'João Silva',
  metadata: {
    preferredLanguage: 'pt-BR',
    tags: ['vip', 'frequent-guest'],
    guestInfo: {
      numberOfStays: 5,
      preferredRoomType: 'Suite',
      preferences: {
        bedType: 'king',
        smokingRoom: false,
      },
      loyaltyProgram: {
        memberId: 'LP123456',
        tier: 'gold',
        points: 5000,
      },
    },
  },
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

// Type-safe access
if (contact.metadata?.guestInfo) {
  const stays = contact.metadata.guestInfo.numberOfStays; // number | undefined
  const tier = contact.metadata.guestInfo.loyaltyProgram?.tier; // string | undefined
}
```

### Message Metadata

```typescript
import { Message, MessageMetadata } from '@/types';

const message: Message = {
  id: '1',
  tenantId: 'tenant-1',
  conversationId: 'conv-1',
  contactId: 'contact-1',
  direction: 'INBOUND',
  type: 'TEXT',
  status: 'READ',
  content: 'Olá, gostaria de fazer uma reserva',
  metadata: {
    ai: {
      generated: false,
      intent: {
        name: 'booking_request',
        confidence: 0.95,
      },
      sentiment: {
        type: 'positive',
        score: 0.8,
      },
      entities: [
        {
          type: 'intent',
          value: 'booking',
          confidence: 0.95,
        },
      ],
    },
    whatsapp: {
      messageId: 'wamid.XXX',
      type: 'text',
    },
  },
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

// Type-safe access to AI metadata
if (message.metadata?.ai?.intent) {
  const intent = message.metadata.ai.intent.name; // string
  const confidence = message.metadata.ai.intent.confidence; // number
}
```

### Conversation Metadata

```typescript
import { Conversation, ConversationMetadata } from '@/types';

const conversation: Conversation = {
  id: 'conv-1',
  tenantId: 'tenant-1',
  contactId: 'contact-1',
  contact: { /* ... */ },
  status: 'IN_PROGRESS',
  iaLocked: false,
  lastMessageAt: '2024-01-01T00:00:00.000Z',
  unreadCount: 0,
  tags: [],
  metadata: {
    business: {
      booking: {
        reference: 'BK123456',
        hotelUnit: 'Ilha Bela',
        checkIn: '2024-12-15T14:00:00.000Z',
        checkOut: '2024-12-20T12:00:00.000Z',
        roomType: 'Suite Deluxe',
        guests: 2,
        status: 'confirmed',
        totalPrice: 2500,
        currency: 'BRL',
      },
    },
    analytics: {
      messageCount: 15,
      avgResponseTime: 120,
      firstResponseTime: 30,
      duration: 1800,
    },
    aiInsights: {
      overallSentiment: {
        type: 'positive',
        score: 0.85,
        trend: 'stable',
      },
      csatPrediction: {
        score: 4.5,
        confidence: 0.9,
      },
    },
  },
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

// Type-safe access to booking info
if (conversation.metadata?.business?.booking) {
  const booking = conversation.metadata.business.booking;
  const checkIn = new Date(booking.checkIn || '');
  const total = booking.totalPrice; // number | undefined
}
```

### Utility Types

```typescript
import { Maybe, isSome, isNone, DeepPartial } from '@/types';

// Maybe type
function findUser(id: string): Maybe<User> {
  // Can return User | null | undefined
  return users.find(u => u.id === id);
}

const user = findUser('123');
if (isSome(user)) {
  // TypeScript knows user is User
  console.log(user.name);
}

if (isNone(user)) {
  // TypeScript knows user is null | undefined
  console.log('User not found');
}

// Deep Partial for complex updates
interface UserSettings {
  notifications: {
    email: {
      marketing: boolean;
      updates: boolean;
    };
    push: {
      enabled: boolean;
    };
  };
}

function updateSettings(settings: DeepPartial<UserSettings>) {
  // Can partially update nested objects
}

updateSettings({
  notifications: {
    email: {
      marketing: false, // Only update this field
    },
  },
});
```

## Best Practices

### 1. Never Use `any`
```typescript
// Bad
function handle(data: any) { }

// Good
import { JSONValue, Maybe } from '@/types';
function handle(data: JSONValue) { }
function handleUser(user: Maybe<User>) { }
```

### 2. Use Type Guards
```typescript
import { isSome } from '@/types';

const contact = await fetchContact(id);
if (isSome(contact)) {
  // Type-safe access
  console.log(contact.name);
}
```

### 3. Type-Safe Metadata Access
```typescript
// Always check before accessing nested metadata
if (message.metadata?.ai?.intent) {
  const intent = message.metadata.ai.intent.name;
  const confidence = message.metadata.ai.intent.confidence;
}

// Use optional chaining
const tier = contact.metadata?.guestInfo?.loyaltyProgram?.tier;
```

### 4. Proper Typing for Forms
```typescript
import { DeepPartial } from '@/types';

interface BookingForm {
  hotelUnit: string;
  checkIn: string;
  checkOut: string;
  guests: number;
}

// Form state can be partial during editing
const [formData, setFormData] = useState<DeepPartial<BookingForm>>({});

// Submit requires complete data
function handleSubmit(data: BookingForm) {
  // ...
}
```

### 5. Component Props
```typescript
import { Contact, Maybe } from '@/types';

interface ContactCardProps {
  contact: Contact;
  onSelect?: (contact: Contact) => void;
  loading?: boolean;
}

function ContactCard({ contact, onSelect, loading = false }: ContactCardProps) {
  // Type-safe props
  if (loading) return <Spinner />;

  return (
    <div onClick={() => onSelect?.(contact)}>
      {contact.name}
    </div>
  );
}
```

## Migration Guide

### Replace `Record<string, any>`

**Before:**
```typescript
interface Contact {
  metadata?: Record<string, any>;
}

// Unsafe access
const tags = contact.metadata?.tags; // any
```

**After:**
```typescript
import { ContactMetadata } from '@/types';

interface Contact {
  metadata?: ContactMetadata;
}

// Type-safe access
const tags = contact.metadata?.tags; // string[] | undefined
```

### Replace Loose Types

**Before:**
```typescript
interface Props {
  data: any;
  callback?: Function;
}
```

**After:**
```typescript
import { JSONValue } from '@/types';

interface Props {
  data: JSONValue;
  callback?: (result: string) => void;
}
```

### Add Proper Null Handling

**Before:**
```typescript
function getUser(): User | null | undefined {
  // ...
}

const user = getUser();
if (user) {
  // Works but verbose
}
```

**After:**
```typescript
import { Maybe, isSome } from '@/types';

function getUser(): Maybe<User> {
  // ...
}

const user = getUser();
if (isSome(user)) {
  // Clean and type-safe
}
```

## Type Safety Checklist

- [ ] No use of `any` type
- [ ] No use of `Record<string, any>` for metadata
- [ ] Proper use of `Maybe<T>` for nullable values
- [ ] Use type guards (`isSome`, `isNone`)
- [ ] Optional chaining for nested access
- [ ] Explicit return types on functions
- [ ] Proper component prop types
- [ ] Type-safe event handlers

## TypeScript Config

The following strict flags are enabled:

```json
{
  "strict": true,
  "noImplicitReturns": true,
  "noUncheckedIndexedAccess": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true,
  "noFallthroughCasesInSwitch": true
}
```

These flags help catch type safety issues at compile time.
