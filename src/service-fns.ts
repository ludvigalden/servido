import { Class } from "./service-types";

/** Determines whether a value is a service class. It can literally be any value, including a function (which would be interpreted as a class
 * in production builds, since they can be constructed like new function() without ES6 features). The `Service` class has the `serviceClassProperty`
 * defined, which this function uses to determine if the `obj` is an extension of `Service`. */
export function isServiceClass<T, A extends any[]>(obj: any): obj is Class<T, A> {
    if (typeof obj === "function") {
        return !!obj[serviceClassProperty];
    } else {
        return false;
    }
}

/** Used in `isServiceClass`, and is intended to be set to a truthy value in the `Service` constructor. */
export const serviceClassProperty = "__service__";

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
