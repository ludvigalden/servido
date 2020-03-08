import React from "react";

import { Servido, Class, requireServido, servidoIdentifier, ServidoDependent, forgoServido } from "../core";

import { useServidoContext, reactServidoContexts } from "./servido-react.context";

const FALLBACK_REACTCONTEXT = React.createContext<Servido | undefined>(undefined);

/**
 * Use a `Servido` inside a component, with or without arguments. If the passed servido or arguments change, a new instance will be required if appropriate.
 * If the servido has been provided by a parent `ServidoProvider` with matching arguments,that will be preferred over looking through the nearest `ServidoContext` (which can also be provided).
 */
export function useServido<S extends Servido>(servido: Class<S, []> | S): S;
export function useServido<S extends Servido, A extends any[]>(servido: Class<S, A> | S, ...arguments_: A): S;
export function useServido<S extends Servido>(servido: Class<S> | S, ...args: any[]) {
    const identifier = servidoIdentifier(args);

    let reactContextType: React.Context<S>;

    const constructedReactContexts = reactServidoContexts.get(servido);

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

    const reactContextServido = React.useContext<S>(reactContextType);

    const dependent = React.useMemo(() => uniqueServidoDependent(), []);
    const context = useServidoContext();

    const current = useClearedMemo(
        () => {
            let next: { dependent: ServidoDependent | undefined; servido: S };

            if (reactContextServido) {
                next = { dependent: undefined, servido: reactContextServido };
            } else {
                next = {
                    dependent,
                    servido: requireServido({ servido, dependent: uniqueServidoDependent(), context }),
                };
            }

            return next;
        },
        (previous) => {
            if (!previous) {
                return;
            }

            if (previous.dependent) {
                forgoServido({ servido: previous.servido, dependent: previous.dependent });
            }
        },
        [servido, identifier, context, reactContextServido],
    );

    return current.servido;
}

const INITIAL_VALUE: never = Symbol("initial") as never;

/** Allows `get` and `clear` for a value based on the identiety of the passed `deps`, as well as being cleared on unmount. */
export function useClearedMemo<T>(get: () => T, clear: (previousValue: T) => void, deps: readonly any[]) {
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
export function uniqueServidoDependent(): ServidoDependent {
    return String(uniqueIndex++);
}
