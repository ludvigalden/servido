import React from "react";

import { ServidoContext, Class, Servido, ServidoIdentifier } from "../core";

export const reactServidoContext = React.createContext<ServidoContext>(ServidoContext.get());
export const reactServidoContexts = new Map<Class<Servido> | Servido, Map<ServidoIdentifier, React.Context<Servido>>>();

/** Provides the `ServidoContext` for requiring contexts to its children, meaning its children and its children only will be sharing context.
 * If a component using a servido is not contained by this provider, it will be sharing context with all other components that are lacking context. */
export function ServidoContextProvider(props: React.PropsWithChildren<{}>) {
    const context = React.useMemo(() => new ServidoContext(), []);

    return React.createElement(reactServidoContext.Provider, { value: context, children: props.children });
}

/** Use the `ServidoContext` provided, or default to the global context that is shared by all other components not being contained by a provider. */
export function useServidoContext() {
    return React.useContext(reactServidoContext);
}
