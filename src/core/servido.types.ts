export type Class<T = unknown, Arguments extends any[] = any[]> = new (...arguments_: Arguments) => T;

/** Describes the identifier of something that's dependent of a servido. */
export type ServidoDependent = keyof any | object;

/** If arguments are passed when constructing a servido, an identifier is generated to ensure that
 * a servido of the same type with equal arguments only exist in one copy at a time. If no arguments
 * are passed when constructing a servido, a servido with any identifier could be returned. Identifiers
 * are only unique per-servido, so identifiers for different context types could be equal. */
export type ServidoIdentifier = keyof any | Class | undefined;
