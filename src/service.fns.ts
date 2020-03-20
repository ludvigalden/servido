import { digest } from "./service.object-hash";
import { Class, ServiceIdentifier } from "./service.types";

export function isClass<T, A extends any[]>(obj: any): obj is Class<T, A> {
    let isConstructor = true;

    try {
        Reflect.construct(String, [], obj);
    } catch (e) {
        isConstructor = false;
    }

    return isConstructor;
}

/** Generate a `ServiceIdentifier` for a set of passed arguments. */
export function serviceIdentifier<A extends any[]>(args: A | undefined): ServiceIdentifier {
    if (!args) {
        return undefined;
    }

    args = args.map((arg) => (arg == null ? undefined : arg)) as A;

    if (args.length <= 1 && typeof args[0] !== "object") {
        return args[0] != null ? args[0] : undefined;
    }

    return digest(args);
}

export function getClassThunkConstructor<T, A extends any[]>(classThunk: Class<T, A> | T): Class<T, A> {
    if (isClass(classThunk)) {
        return classThunk as Class<T, A>;
    }

    const prototype = Object.getPrototypeOf(classThunk);

    return prototype.constructor || prototype;
}
