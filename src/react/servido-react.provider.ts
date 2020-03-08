import React from "react";

import { Servido, servidoIdentifier, isClass, constructServido, ServidoIdentifier, Class, getClassThunkConstructor } from "../core";

import { useServidoContext, reactServidoContexts } from "./servido-react.context";
import { useClearedMemo } from "./servido-react.hooks";

export function ServidoProvider<S extends Servido>(props: React.PropsWithChildren<ServidoProviderProps<S>>): JSX.Element;
export function ServidoProvider<S extends Servido, A extends any[]>(
    props: React.PropsWithChildren<ServidoProviderPropsWithArgs<S, A>>,
): JSX.Element;
export function ServidoProvider<S extends Servido>(props: React.PropsWithChildren<ServidoProviderPropsWithArgs<S, any[]>>) {
    const context = useServidoContext();

    const servidoReactContext = React.useMemo<React.Context<S>>(() => {
        const identifier = props.args ? servidoIdentifier(props.args) : undefined;

        const constructor = getClassThunkConstructor(props.servido);
        let servidoReactContexts: Map<ServidoIdentifier, React.Context<S> | React.Context<undefined> | undefined>;

        if (reactServidoContexts.has(constructor)) {
            servidoReactContexts = reactServidoContexts.get(constructor) as any;
        } else {
            servidoReactContexts = new Map();
            reactServidoContexts.set(constructor, servidoReactContexts as any);
        }

        let servidoReactContext: React.Context<S> | React.Context<undefined> | undefined;

        if (servidoReactContexts.has(identifier)) {
            servidoReactContext = servidoReactContexts.get(identifier);
        } else if (!identifier && servidoReactContexts.size) {
            servidoReactContext = servidoReactContexts.get(servidoReactContexts.keys().next().value);
        } else {
            servidoReactContext = React.createContext(undefined);
            servidoReactContexts.set(identifier, servidoReactContext);
        }

        return servidoReactContext as React.Context<S>;
    }, []);

    const servido = useClearedMemo<{ constructed: S; servido: undefined } | { constructed: undefined; servido: S }>(
        () =>
            isClass(props.servido)
                ? { constructed: constructServido<S, any[]>({ servido: props.servido, args: props.args, context }), servido: undefined }
                : { constructed: undefined, servido: props.servido },
        ({ constructed }) => {
            if (constructed) {
                Servido.deconstruct(constructed);
            }
        },
        [props.servido, ...(props.args || [])],
    );

    return React.createElement(servidoReactContext.Provider, {
        value: (servido.constructed || servido.servido) as S,
        children: props.children,
    });
}

export interface ServidoProviderProps<S extends Servido> {
    servido: Class<S, []> | S;
}

export interface ServidoProviderPropsWithArgs<S extends Servido, A extends any[]> {
    servido: Class<S, A> | S;
    args?: A;
}
