import { Service, ServiceConstructor, ServiceQuery } from "./service";
import { Class } from "./service-types";

/** Determines whether a value is a service class. It can literally be any value, including a function (which would be interpreted as a class
 * in production builds, since they can be constructed like new function() without ES6 features). The `Service` class has the `ServiceConstructorProperty`
 * defined, which this function uses to determine if the `obj` is an extension of `Service`. */
export function isServiceConstructor<T, A extends any[]>(obj: any): obj is Class<T, A> {
    if (typeof obj === "function") {
        return !!obj[ServiceConstructorProperty];
    } else {
        return false;
    }
}

/** Used in `isServiceConstructor`, and is intended to be set to a truthy value in the `Service` constructor. */
export const ServiceConstructorProperty = "__service__";

export function isPromise(v: any): v is Promise<any> {
    return v && typeof v["then"] === "function";
}

export function resolveModuleThunk<T>(moduleThunk: ModuleThunk<T>): T {
    if (!moduleThunk) {
        return;
    } else if ((moduleThunk as any).default) {
        return (moduleThunk as any).default;
    } else if (typeof moduleThunk === "object") {
        if (Array.isArray(moduleThunk)) {
            return moduleThunk as any;
        } else {
            const keys = Object.keys(moduleThunk);
            if (keys.length > 1) {
                console.warn(
                    `"Multiple exports were found in module, while only one was expected. Using the first one found (\"${keys[0]}\"), but please specify the module thunk "` +
                        "or remove any superflous exports. Module: ",
                    moduleThunk,
                );
            }
            if (keys.length === 1) {
                return moduleThunk[keys[0]];
            }
        }
    } else {
        return moduleThunk;
    }
}

export type ModuleThunk<T> = T | DefaultModule<T> | SingleExportModule<T>;

interface SingleExportModule<T> {
    [key: string]: T;
}

interface DefaultModule<T> {
    default: T;
}

export function parseServiceQuery<S extends Service, A extends any[]>(
    service: ServiceQuery<S, A>,
    args?: A,
): { constructor: ServiceConstructor<S, A>; instance?: S; args?: A } {
    if (!service) {
        return { constructor: undefined, args };
    }
    if (Array.isArray(service)) {
        args = service.slice(1) as any;
        service = service[0] as any;
    }
    if (isServiceConstructor(service)) {
        return { constructor: service as ServiceConstructor<S, A>, args };
    } else if (service instanceof Service) {
        const prototype = Object.getPrototypeOf(service);
        return { constructor: prototype.constructor || prototype, instance: service, args };
    } else if (service["getService"]) {
        return parseServiceQuery<S, A>(service["getService"](...((args || []) as A)), args);
    } else if (service["service"]) {
        return parseServiceQuery<S, A>(service["service"], args);
    } else if (typeof service === "function") {
        return parseServiceQuery<S, A>((service as any)(...((args || []) as A)), args);
    }
    console.error("Unable to resolve class for service ", service);
    return { constructor: Service as any };
}
