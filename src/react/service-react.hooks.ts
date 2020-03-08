import React from "react";

import {
    Service,
    Class,
    requireService,
    serviceIdentifier,
    ServiceDependent,
    forgoService,
    filterErrorStack,
    getClassThunkConstructor,
} from "../core";

import { useServiceContext, reactServiceContexts } from "./service-react.context";

const fallbackReactContextType = React.createContext<Service | undefined>(undefined);

/**
 * Use a `Service` inside a component, with or without arguments. If the passed service or arguments change, a new instance will be required if appropriate.
 * If the service has been provided by a parent `ServiceProvider` with matching arguments, that will be preferred over looking through the nearest `ServiceContext` (which can also be provided).
 */
/** If the service accepts arguments, those can be passed as additional arguments to the hook. Whenever the passed service or arguments change, a new instance may or may not be constructed.
 * If an instance of the service has been provided by a parent using `ServiceProvider`, that instance will be preferred unless there is a mismatch of arguments. */
export function useService<S extends Service>(service: Class<S, []> | S): S;
export function useService<S extends Service, A extends any[]>(service: Class<S, A> | S, ...arguments_: A): S;
export function useService<S extends Service>(service: Class<S> | S, ...args: any[]) {
    const id = serviceIdentifier(args);

    let reactContextType: React.Context<S>;

    const constructedReactContexts = reactServiceContexts.get(getClassThunkConstructor(service));

    if (constructedReactContexts) {
        if (constructedReactContexts.has(id)) {
            reactContextType = constructedReactContexts.get(id) as any;
        } else if (!id && constructedReactContexts.size) {
            reactContextType = constructedReactContexts.get(constructedReactContexts.keys().next().value) as any;
        } else {
            reactContextType = fallbackReactContextType as any;
        }
    } else {
        reactContextType = fallbackReactContextType as any;
    }

    const reactContextService = React.useContext<S>(reactContextType);

    const context = useServiceContext();

    try {
        const current = useClearedMemo(
            () => {
                let next: { dependent: ServiceDependent | undefined; service: S };

                if (reactContextService && (id == null || reactContextService[Service.key.id] === id)) {
                    next = { dependent: undefined, service: reactContextService };
                } else {
                    const dependent = uniqueServiceDependent();

                    next = {
                        dependent,
                        service: requireService({ service, dependent, context, args }),
                    };
                }

                return next;
            },
            (previous) => {
                if (!previous) {
                    return;
                }

                if (previous.dependent) {
                    forgoService({ service: previous.service, dependent: previous.dependent });
                }
            },
            [service, id, context, reactContextService],
        );

        return current.service;
    } catch (error) {
        throw filterErrorStack(error);
    }
}

const INITIAL_VALUE: never = Symbol("initial") as never;

/** Allows `get` and `clear` for a value based on the identiety of the passed `deps`, as well as being cleared on unmount. */
export function useClearedMemo<T>(get: () => T, clear: (previousValue: T) => void, deps: readonly any[] = []) {
    const valueRef = React.useRef<T>(INITIAL_VALUE);

    React.useMemo(() => {
        if (valueRef.current !== INITIAL_VALUE) {
            clear(valueRef.current);
        }

        valueRef.current = get();
    }, deps);

    /** Call the `clear` fn on unmount. */
    React.useEffect(
        () => () => {
            clear(valueRef.current);
            valueRef.current = INITIAL_VALUE;
        },
        [],
    );

    return valueRef.current;
}

/** Ensures that subscriptions are in sync with the `deps`. */
export function useMemoEffect(getClearEffect: () => () => any, deps: readonly any[]) {
    useClearedMemo(getClearEffect, (clearEffect) => typeof clearEffect === "function" && clearEffect(), deps);
}

let uniqueIndex = 0;

/** Get a string that can be safely assumed to be unique among service dependents. */
export function uniqueServiceDependent(): ServiceDependent & string {
    return String(uniqueIndex++);
}
