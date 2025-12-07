/**
 * Frontend Utility Types
 *
 * Common utility types for type-safe frontend development
 * Simplified version focused on frontend needs
 */

// ============================================
// BASIC UTILITIES
// ============================================

/**
 * Nullable type - value can be null
 */
export type Nullable<T> = T | null;

/**
 * Optional type - value can be undefined
 */
export type Optional<T> = T | undefined;

/**
 * Maybe type - value can be null or undefined
 */
export type Maybe<T> = T | null | undefined;

/**
 * ISO 8601 date string
 */
export type ISODateString = string;

/**
 * Type-safe JSON value
 */
export type JSONValue = string | number | boolean | null | JSONObject | JSONArray;

export interface JSONObject {
  [key: string]: JSONValue;
}

export interface JSONArray extends Array<JSONValue> {}

// ============================================
// OBJECT UTILITIES
// ============================================

/**
 * Deep partial - makes all nested properties optional
 */
export type DeepPartial<T> = T extends object
  ? { [P in keyof T]?: DeepPartial<T[P]> }
  : T;

/**
 * Deep readonly - makes all nested properties readonly
 */
export type DeepReadonly<T> = T extends object
  ? { readonly [P in keyof T]: DeepReadonly<T[P]> }
  : T;

/**
 * Make specific keys required
 */
export type RequireKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Make specific keys optional
 */
export type OptionalKeys<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Merge two types (B overrides A)
 */
export type Merge<A, B> = Omit<A, keyof B> & B;

/**
 * Value of a specific object property
 */
export type ValueOf<T> = T[keyof T];

// ============================================
// TYPE GUARDS
// ============================================

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
