import React from "react";

import { Servido, servidoIdentifier, isClass, constructServido, ServidoIdentifier, Class } from "../core";

import { useServidoContext, reactServidoContexts } from "./servido-react.context";

export function ServidoProvider<S extends Servido>(props: React.PropsWithChildren<ServidoProviderProps<S>>): JSX.Element;
export function ServidoProvider<S extends Servido, A extends any[]>(
    props: React.PropsWithChildren<ServidoProviderPropsWithArgs<S, A>>,
): JSX.Element;
export function ServidoProvider<S extends Servido>(props: React.PropsWithChildren<ServidoProviderPropsWithArgs<S, any[]>>) {
    const context = useServidoContext();

    const reactServido = React.useMemo<React.Context<S>>(() => {
        const identifier = props.args ? servidoIdentifier(props.args) : undefined;

        let servidoReactContexts: Map<ServidoIdentifier, React.Context<S> | React.Context<undefined> | undefined>;

        if (reactServidoContexts.has(props.servido)) {
            servidoReactContexts = reactServidoContexts.get(props.servido) as any;
        } else {
            servidoReactContexts = new Map();
            reactServidoContexts.set(props.servido, servidoReactContexts as any);
        }

        let servido: React.Context<S> | React.Context<undefined> | undefined;

        if (servidoReactContexts.has(identifier)) {
            servido = servidoReactContexts.get(identifier);
        } else if (!identifier && servidoReactContexts.size) {
            servido = servidoReactContexts.get(servidoReactContexts.keys().next().value);
        } else {
            servido = React.createContext(undefined);
            servidoReactContexts.set(identifier, servido);
        }

        return servido as React.Context<S>;
    }, []);

    const servido = React.useMemo(
        () => (isClass(props.servido) ? constructServido<S, any[]>({ servido: props.servido, args: props.args, context }) : props.servido),
        [props.servido],
    );

    return React.createElement(reactServido.Provider, { value: servido, children: props.children });
}

export interface ServidoProviderProps<S extends Servido> {
    servido: Class<S, []> | S;
}

export interface ServidoProviderPropsWithArgs<S extends Servido, A extends any[]> {
    servido: Class<S, A> | S;
    args?: A;
}
