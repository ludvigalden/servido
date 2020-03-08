import React from "react";

import { Service, Class, requireService, serviceIdentifier, ServiceDependent, forgoService } from "../core";

import { useServiceContext, reactServiceContexts } from "./service-react.context";

const FALLBACK_REACTCONTEXT = React.createContext<Service | undefined>(undefined);

/**
 * Use a `Service` inside a component, with or without arguments. If the passed service or arguments change, a new instance will be required if appropriate.
 * If the service has been provided by a parent `ServiceProvider` with matching arguments,that will be preferred over looking through the nearest `ServiceContext` (which can also be provided).
 */
export function useService<S extends Service>(service: Class<S, []> | S): S;
export function useService<S extends Service, A extends any[]>(service: Class<S, A> | S, ...arguments_: A): S;
export function useService<S extends Service>(service: Class<S> | S, ...args: any[]) {
    const identifier = serviceIdentifier(args);

    let reactContextType: React.Context<S>;

    const constructedReactContexts = reactServiceContexts.get(service);

    if (constructedReactContexts) {
        if (constructedReactContexts.has(identifier)) {
            reactContextType = constructedReactContexts.get(identifier) as any;
        } else if (!identifier && constructedReactContexts.size) {
            reactContextType = constructedReactContexts.get(constructedReactContexts.keys().next().value) as any;
        } else {
            reactContextType = FALLBACK_REACTCONTEXT as any;
        }
    } else {
        reactContextType = FALLBACK_REACTCONTEXT as any;
    }

    const reactContextService = React.useContext<S>(reactContextType);

    const context = useServiceContext();

    const current = useClearedMemo(
        () => {
            let next: { dependent: ServiceDependent | undefined; service: S };

            if (reactContextService) {
                next = { dependent: undefined, service: reactContextService };
            } else {
                const dependent = uniqueServiceDependent();

                next = {
                    dependent,
                    service: requireService({ service, dependent, context }),
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
        [service, identifier, context, reactContextService],
    );

    return current.service;
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

/** Get a string unique to this runtime. */
export function uniqueServiceDependent(): ServiceDependent {
    return String(uniqueIndex++);
}
