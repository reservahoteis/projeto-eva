/**
 * Utility Types
 *
 * Reusable type utilities for type-safe application development
 * These types provide common patterns for error handling, optionality,
 * pagination, and API responses.
 */

// ============================================
// RESULT TYPES (Railway-Oriented Programming)
// ============================================

/**
 * Result type for operations that can succeed or fail
 * Inspired by Rust's Result<T, E> and Railway-Oriented Programming
 *
 * @template T - Success value type
 * @template E - Error type (defaults to Error)
 *
 * @example
 * function divide(a: number, b: number): Result<number, string> {
 *   if (b === 0) {
 *     return { success: false, error: 'Division by zero' };
 *   }
 *   return { success: true, data: a / b };
 * }
 */
export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * Async version of Result for Promise-based operations
 *
 * @template T - Success value type
 * @template E - Error type (defaults to Error)
 *
 * @example
 * async function fetchUser(id: string): AsyncResult<User, ApiError> {
 *   try {
 *     const user = await db.user.findUnique({ where: { id } });
 *     if (!user) {
 *       return { success: false, error: { code: 404, message: 'User not found' } };
 *     }
 *     return { success: true, data: user };
 *   } catch (error) {
 *     return { success: false, error: { code: 500, message: 'Database error' } };
 *   }
 * }
 */
export type AsyncResult<T, E = Error> = Promise<Result<T, E>>;

/**
 * Extract success type from Result
 */
export type ResultData<T> = T extends Result<infer D, unknown> ? D : never;

/**
 * Extract error type from Result
 */
export type ResultError<T> = T extends Result<unknown, infer E> ? E : never;

// ============================================
// OPTIONAL & NULLABLE TYPES
// ============================================

/**
 * Nullable type - value can be null
 *
 * @example
 * const userId: Nullable<string> = null;
 * const userName: Nullable<string> = 'John';
 */
export type Nullable<T> = T | null;

/**
 * Optional type - value can be undefined
 *
 * @example
 * const config: Optional<Config> = undefined;
 */
export type Optional<T> = T | undefined;

/**
 * Maybe type - value can be null or undefined
 * Common in functional programming
 *
 * @example
 * const value: Maybe<number> = null;
 * const value2: Maybe<number> = undefined;
 * const value3: Maybe<number> = 42;
 */
export type Maybe<T> = T | null | undefined;

/**
 * NonNullable recursive - deeply removes null and undefined
 */
export type DeepNonNullable<T> = T extends object
  ? { [K in keyof T]-?: DeepNonNullable<NonNullable<T[K]>> }
  : NonNullable<T>;

// ============================================
// PARTIAL & READONLY TYPES
// ============================================

/**
 * Deep partial - makes all nested properties optional
 *
 * @example
 * interface User {
 *   name: string;
 *   address: {
 *     street: string;
 *     city: string;
 *   }
 * }
 *
 * const partialUser: DeepPartial<User> = {
 *   address: { city: 'New York' } // street is optional
 * };
 */
export type DeepPartial<T> = T extends object
  ? { [P in keyof T]?: DeepPartial<T[P]> }
  : T;

/**
 * Deep readonly - makes all nested properties readonly
 *
 * @example
 * const config: DeepReadonly<Config> = { db: { host: 'localhost' } };
 * config.db.host = 'other'; // Error: readonly
 */
export type DeepReadonly<T> = T extends object
  ? { readonly [P in keyof T]: DeepReadonly<T[P]> }
  : T;

/**
 * Mutable - removes readonly from all properties
 *
 * @example
 * type ReadonlyUser = { readonly name: string };
 * type MutableUser = Mutable<ReadonlyUser>; // { name: string }
 */
export type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

/**
 * Deep mutable - recursively removes readonly
 */
export type DeepMutable<T> = T extends object
  ? { -readonly [P in keyof T]: DeepMutable<T[P]> }
  : T;

// ============================================
// OBJECT MANIPULATION TYPES
// ============================================

/**
 * Make specific keys required
 *
 * @example
 * type User = { id?: string; name?: string; email?: string };
 * type UserWithId = RequireKeys<User, 'id' | 'email'>;
 * // { id: string; name?: string; email: string }
 */
export type RequireKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Make specific keys optional
 *
 * @example
 * type User = { id: string; name: string; email: string };
 * type UserUpdate = OptionalKeys<User, 'name' | 'email'>;
 * // { id: string; name?: string; email?: string }
 */
export type OptionalKeys<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Pick by value type
 *
 * @example
 * type User = { id: string; age: number; active: boolean };
 * type StringProps = PickByType<User, string>; // { id: string }
 */
export type PickByType<T, V> = Pick<T, {
  [K in keyof T]: T[K] extends V ? K : never;
}[keyof T]>;

/**
 * Omit by value type
 */
export type OmitByType<T, V> = Pick<T, {
  [K in keyof T]: T[K] extends V ? never : K;
}[keyof T]>;

/**
 * Create type with exactly one property from union
 *
 * @example
 * type Config = ExactlyOne<{ auth: string; apiKey: string; token: string }>;
 * // Valid: { auth: string } | { apiKey: string } | { token: string }
 * // Invalid: { auth: string; apiKey: string }
 */
export type ExactlyOne<T, Keys extends keyof T = keyof T> = Keys extends keyof T
  ? { [K in Keys]: T[K] } & { [K in Exclude<keyof T, Keys>]?: never }
  : never;

/**
 * Strict omit - ensures keys exist in type
 */
export type StrictOmit<T, K extends keyof T> = Omit<T, K>;

/**
 * Strict pick - ensures keys exist in type
 */
export type StrictPick<T, K extends keyof T> = Pick<T, K>;

// ============================================
// PAGINATION TYPES
// ============================================

/**
 * Standard pagination parameters
 *
 * @example
 * function getUsers(params: PaginationParams): Promise<PaginatedResult<User>> {
 *   // Implementation
 * }
 */
export interface PaginationParams {
  /**
   * Page number (1-indexed)
   * @minimum 1
   */
  page: number;

  /**
   * Number of items per page
   * @minimum 1
   * @maximum 100
   */
  limit: number;

  /**
   * Sort field
   */
  sortBy?: string;

  /**
   * Sort direction
   */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  /**
   * Current page number
   */
  page: number;

  /**
   * Items per page
   */
  limit: number;

  /**
   * Total number of items
   */
  total: number;

  /**
   * Total number of pages
   */
  totalPages: number;

  /**
   * Whether there is a previous page
   */
  hasPreviousPage: boolean;

  /**
   * Whether there is a next page
   */
  hasNextPage: boolean;
}

/**
 * Paginated result wrapper
 *
 * @template T - Type of items in the result
 *
 * @example
 * const users: PaginatedResult<User> = {
 *   data: [{ id: '1', name: 'John' }],
 *   pagination: {
 *     page: 1,
 *     limit: 10,
 *     total: 1,
 *     totalPages: 1,
 *     hasPreviousPage: false,
 *     hasNextPage: false
 *   }
 * };
 */
export interface PaginatedResult<T> {
  data: T[];
  pagination: PaginationMeta;
}

/**
 * Cursor-based pagination parameters (for infinite scroll)
 *
 * @example
 * function getMessages(params: CursorPaginationParams): Promise<CursorPaginatedResult<Message>> {
 *   // Implementation
 * }
 */
export interface CursorPaginationParams {
  /**
   * Cursor for next page
   */
  cursor?: string;

  /**
   * Number of items to fetch
   * @minimum 1
   * @maximum 100
   */
  limit: number;

  /**
   * Direction to paginate
   */
  direction?: 'forward' | 'backward';
}

/**
 * Cursor-based paginated result
 */
export interface CursorPaginatedResult<T> {
  data: T[];
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: Maybe<string>;
    endCursor: Maybe<string>;
  };
}

// ============================================
// API RESPONSE TYPES
// ============================================

/**
 * Standard API success response
 *
 * @template T - Type of response data
 *
 * @example
 * const response: ApiResponse<User> = {
 *   success: true,
 *   data: { id: '1', name: 'John' },
 *   message: 'User retrieved successfully'
 * };
 */
export interface ApiResponse<T = unknown> {
  /**
   * Whether the request was successful
   */
  success: true;

  /**
   * Response data
   */
  data: T;

  /**
   * Optional success message
   */
  message?: string;

  /**
   * Optional metadata
   */
  meta?: Record<string, unknown>;
}

/**
 * Standard API error response
 *
 * @example
 * const error: ApiErrorResponse = {
 *   success: false,
 *   error: {
 *     code: 'USER_NOT_FOUND',
 *     message: 'User with ID 123 not found',
 *     statusCode: 404
 *   }
 * };
 */
export interface ApiErrorResponse {
  /**
   * Always false for errors
   */
  success: false;

  /**
   * Error details
   */
  error: {
    /**
     * Error code (machine-readable)
     */
    code: string;

    /**
     * Error message (human-readable)
     */
    message: string;

    /**
     * HTTP status code
     */
    statusCode: number;

    /**
     * Additional error details
     */
    details?: unknown;

    /**
     * Stack trace (only in development)
     */
    stack?: string;

    /**
     * Validation errors
     */
    validationErrors?: ValidationError[];
  };
}

/**
 * Validation error
 */
export interface ValidationError {
  /**
   * Field that failed validation
   */
  field: string;

  /**
   * Validation error message
   */
  message: string;

  /**
   * Validation rule that failed
   */
  rule?: string;

  /**
   * Value that failed validation
   */
  value?: unknown;
}

/**
 * Union of success and error responses
 */
export type ApiResult<T = unknown> = ApiResponse<T> | ApiErrorResponse;

// ============================================
// TIME & DATE TYPES
// ============================================

/**
 * ISO 8601 date string
 *
 * @example
 * const date: ISODateString = '2024-01-01T00:00:00.000Z';
 */
export type ISODateString = string;

/**
 * Unix timestamp (seconds since epoch)
 */
export type UnixTimestamp = number;

/**
 * Unix timestamp in milliseconds
 */
export type UnixTimestampMs = number;

/**
 * Date range
 */
export interface DateRange {
  start: ISODateString;
  end: ISODateString;
}

// ============================================
// TYPE UTILITIES
// ============================================

/**
 * Extract keys that are required
 */
export type RequiredKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? never : K;
}[keyof T];

/**
 * Extract keys that are optional
 */
export type OptionalPropertyKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? K : never;
}[keyof T];

/**
 * Get function argument types
 */
export type ArgumentTypes<F extends (...args: any[]) => any> = F extends (...args: infer A) => any ? A : never;

/**
 * Get function return type (async-aware)
 */
export type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;

/**
 * Get array element type
 */
export type ArrayElement<T> = T extends (infer E)[] ? E : never;

/**
 * Get keys that match a specific type
 */
export type KeysOfType<T, U> = {
  [K in keyof T]: T[K] extends U ? K : never;
}[keyof T];

/**
 * Constructor type
 */
export type Constructor<T = any> = new (...args: any[]) => T;

/**
 * Abstract constructor type
 */
export type AbstractConstructor<T = any> = abstract new (...args: any[]) => T;

/**
 * Ensure at least one property is defined
 */
export type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = Pick<T, Exclude<keyof T, Keys>> &
  {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>;
  }[Keys];

/**
 * Value of a specific object property
 */
export type ValueOf<T> = T[keyof T];

/**
 * Merge two types (B overrides A)
 */
export type Merge<A, B> = Omit<A, keyof B> & B;

/**
 * Type-safe JSON value
 */
export type JSONValue = string | number | boolean | null | JSONObject | JSONArray;

export interface JSONObject {
  [key: string]: JSONValue;
}

export interface JSONArray extends Array<JSONValue> {}

/**
 * Type-safe JSON primitive
 */
export type JSONPrimitive = string | number | boolean | null;

// ============================================
// TYPE GUARDS
// ============================================

/**
 * Type guard for success result
 */
export function isSuccess<T, E>(result: Result<T, E>): result is { success: true; data: T } {
  return result.success === true;
}

/**
 * Type guard for error result
 */
export function isError<T, E>(result: Result<T, E>): result is { success: false; error: E } {
  return result.success === false;
}

/**
 * Type guard for Maybe type
 */
export function isSome<T>(value: Maybe<T>): value is T {
  return value !== null && value !== undefined;
}

/**
 * Type guard for null/undefined
 */
export function isNone<T>(value: Maybe<T>): value is null | undefined {
  return value === null || value === undefined;
}

/**
 * Type guard for API success response
 */
export function isApiSuccess<T>(response: ApiResult<T>): response is ApiResponse<T> {
  return response.success === true;
}

/**
 * Type guard for API error response
 */
export function isApiError(response: ApiResult): response is ApiErrorResponse {
  return response.success === false;
}
