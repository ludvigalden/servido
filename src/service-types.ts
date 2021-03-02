export type Class<T = unknown, Arguments extends any[] = any[]> = new (...arguments_: Arguments) => T;

/** If arguments are passed when constructing a service, an id is generated to ensure that
 * a service of the same type with equal arguments only exist in one copy at a time. If no arguments
 * are passed when constructing a service, a service with any id could be returned. Identifiers
 * are only unique per-service, so ids for different context types could be equal. */
export type ServiceIdentifier = keyof any | object | boolean | undefined;

export type ServiceDataKey = string;
export type ServiceDataIdentifier = string;

export interface ServiceDataRecord extends Record<ServiceDataKey, Record<ServiceDataIdentifier, any>> {}

export interface ServiceData {
    data: Record<ServiceDataKey, Record<ServiceDataIdentifier, any> | any> | undefined;
    dataErrors: Record<ServiceDataKey, Record<ServiceDataIdentifier, any> | any> | undefined;
    globalData: Record<ServiceDataKey, Record<ServiceDataIdentifier, any> | any> | undefined;
    globalDataErrors: Record<ServiceDataKey, Record<ServiceDataIdentifier, any> | any> | undefined;
    params: servido.Params | undefined;
}
