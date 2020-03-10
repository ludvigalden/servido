import React from "react";

import { useServiceContext, reactServiceContexts } from "./service-react.context";
import { useClearedMemo } from "./service-react.hooks";
import { serviceIdentifier, isClass, getClassThunkConstructor } from "./service.fns";
import { ServiceIdentifier, Class } from "./service.types";
import { constructService } from "./service.construct";
import { Service } from "./service";

/** Constructs and provides a `service` to its children, no matter if it has already been constructed in the context. Does not add the instance to the relevant `ServiceContext`. */
export function ServiceProvider<S extends Service>(props: React.PropsWithChildren<ServiceProviderProps<S>>): JSX.Element;
export function ServiceProvider<S extends Service, A extends any[]>(
    props: React.PropsWithChildren<ServiceProviderPropsWithArgs<S, A>>,
): JSX.Element;
export function ServiceProvider<S extends Service>(props: React.PropsWithChildren<ServiceProviderPropsWithArgs<S, any[]>>) {
    const context = useServiceContext();
    const identifier = serviceIdentifier(props.args);

    const serviceReactContext = React.useMemo<React.Context<S>>(() => {
        const constructor = getClassThunkConstructor(props.service);
        let serviceReactContexts: Map<ServiceIdentifier, React.Context<S> | React.Context<undefined> | undefined>;

        if (reactServiceContexts.has(constructor)) {
            serviceReactContexts = reactServiceContexts.get(constructor) as any;
        } else {
            serviceReactContexts = new Map();
            reactServiceContexts.set(constructor, serviceReactContexts as any);
        }

        let serviceReactContext: React.Context<S> | React.Context<undefined> | undefined;

        if (serviceReactContexts.has(identifier)) {
            serviceReactContext = serviceReactContexts.get(identifier);
        } else if (!identifier && serviceReactContexts.size) {
            serviceReactContext = serviceReactContexts.get(serviceReactContexts.keys().next().value);
        } else {
            serviceReactContext = React.createContext(undefined);
            serviceReactContexts.set(identifier, serviceReactContext);
        }

        return serviceReactContext as React.Context<S>;
    }, [identifier, props.service]);

    const service = useClearedMemo<{ constructed: S; service: undefined } | { constructed: undefined; service: S }>(
        () => {
            if (isClass(props.service)) {
                return {
                    constructed: constructService<S, any[]>({ service: props.service, args: props.args, context }),
                    service: undefined,
                };
            } else {
                return { constructed: undefined, service: props.service };
            }
        },
        ({ constructed }) => {
            if (constructed) {
                Service.deconstruct(constructed);
            }
        },
        [props.service, context, ...(props.args || [])],
    );

    return React.createElement(serviceReactContext.Provider, {
        value: (service.constructed || service.service) as S,
        children: props.children,
    });
}

export interface ServiceProviderProps<S extends Service> {
    service: Class<S, []> | S;
}

export interface ServiceProviderPropsWithArgs<S extends Service, A extends any[]> {
    service: Class<S, A> | S;
    args?: A;
}
