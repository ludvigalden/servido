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

export function serviceIdentifier<A extends any[]>(args: A | undefined): ServiceIdentifier | undefined {
    if (!args) {
        return undefined;
    }

    args = args.filter((argument) => argument != null) as A;

    if (args.length <= 1) {
        return args[0];
    }

    return args.map((argument) => String(argument)).join();
}

export function getClassThunkConstructor<T, A extends any[]>(classThunk: Class<T, A> | T): Class<T, A> {
    if (isClass(classThunk)) {
        return classThunk as Class<T, A>;
    }

    const prototype = Object.getPrototypeOf(classThunk);

    return prototype.constructor || prototype;
}

/** Since a lot of different functions are used in this package, when an error is thrown when constructing a service, the stack contains a lot of unhelpful lines. */
export function filterErrorStack(error: Error, ...filter: string[]) {
    if (error.stack) {
        const original: string[] = error.stack.split("\n");

        let filtered: string[];

        if (original.find((trace) => trace.includes("forgoService"))) {
            let anonymousTraces = original.filter((original) => original.includes("at http"));
            anonymousTraces = anonymousTraces.reverse().slice(0, Math.min(anonymousTraces.length - 1, 4));

            filtered = original.filter(
                (trace) =>
                    !(
                        anonymousTraces.includes(trace) ||
                        [
                            "useClearedMemo",
                            "useMemo",
                            "useService",
                            "requireService",
                            "mountMemo",
                            "Function.deconstruct",
                            ...filter,
                        ].some((filteredTrace) => trace.includes(filteredTrace))
                    ),
            );
        } else {
            filtered = original.filter(
                (trace) =>
                    ![
                        "useClearedMemo",
                        "useMemo",
                        "useService",
                        "requireService",
                        "mountMemo",
                        "at http",
                        ...filter,
                    ].some((filteredTrace) => trace.includes(filteredTrace)),
            );
        }
        error.stack = filtered.join("\n");
    }

    return error;
}
