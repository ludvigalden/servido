export type Class<T = unknown, Arguments extends any[] = any[]> = new (...arguments_: Arguments) => T;

/** Describes the identifier of something that's dependent of a service. */
export type ServiceDependent = keyof any | object;

/** If arguments are passed when constructing a service, an identifier is generated to ensure that
 * a service of the same type with equal arguments only exist in one copy at a time. If no arguments
 * are passed when constructing a service, a service with any identifier could be returned. Identifiers
 * are only unique per-service, so identifiers for different context types could be equal. */
export type ServiceIdentifier = keyof any | Class | undefined;
