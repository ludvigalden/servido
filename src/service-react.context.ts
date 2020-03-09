import React from "react";

import { ServiceContext } from "./service-context";
import { Class, ServiceIdentifier } from "./service.types";
import { Service } from "./service";

export const reactServiceContext = React.createContext<ServiceContext>(ServiceContext.get());
export const reactServiceContexts = new Map<Class<Service> | Service, Map<ServiceIdentifier, React.Context<Service>>>();

/** Provides the `ServiceContext` for requiring contexts to its children, meaning its children and its children only will be sharing context.
 * If a component using a service is not contained by this provider, it will be sharing context with all other components that are lacking context. */
export function ServiceContextProvider(props: React.PropsWithChildren<{}>) {
    const context = React.useMemo(() => new ServiceContext(), []);

    return React.createElement(reactServiceContext.Provider, { value: context, children: props.children });
}

/** Use the `ServiceContext` provided, or default to the global context that is shared by all other components not being contained by a provider. */
export function useServiceContext() {
    return React.useContext(reactServiceContext);
}
