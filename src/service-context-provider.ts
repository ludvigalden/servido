import React from "react";

import { ServiceContext, ServiceContextProps } from "./service-context";

/** Provides the `ServiceContext` for requiring contexts to its children, meaning its children and its children only will be sharing context.
 * If a component using a service is not contained by this provider, it will be sharing context with all other components that are lacking context. */
export function ServiceContextProvider(props: React.PropsWithChildren<ServiceContextProviderProps>) {
    let context = props.context;

    if (!context) {
        const parent = props.parent === null ? undefined : props.parent || ServiceContext.use();
        context = React.useMemo(
            () =>
                new ServiceContext({
                    ...props,
                    parent,
                }),
            [parent, props.nestStore, ...(props.paramsDeps || [])],
        );
    }

    return React.createElement(ServiceContext.reactContext.Provider, { value: context, children: props.children });
}

interface ServiceContextProviderProps extends ServiceContextProps {
    /** If an explicit context should be provided (no other properties will be used). */
    context?: ServiceContext;
    /** If the parent should be defined explicitly. If `null`, no parent will be used. If `undefined`, any context provided by a parent
     * `ServiceContextProvider` will be used, and otherwise default to the `ServiceContext.default`. */
    parent?: ServiceContext;
    /** If a new context should be constructed if the `params` change. */
    paramsDeps?: readonly any[];
}
