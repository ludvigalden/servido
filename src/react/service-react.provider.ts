import React from "react";

import {
    Service,
    serviceIdentifier,
    isClass,
    constructService,
    ServiceIdentifier,
    Class,
    getClassThunkConstructor,
    filterErrorStack,
} from "../core";

import { useServiceContext, reactServiceContexts } from "./service-react.context";
import { useClearedMemo } from "./service-react.hooks";

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

    let service: { constructed: S; service: undefined } | { constructed: undefined; service: S };

    try {
        service = useClearedMemo<{ constructed: S; service: undefined } | { constructed: undefined; service: S }>(
            () =>
                isClass(props.service)
                    ? { constructed: constructService<S, any[]>({ service: props.service, args: props.args, context }), service: undefined }
                    : { constructed: undefined, service: props.service },
            ({ constructed }) => {
                if (constructed) {
                    Service.deconstruct(constructed);
                }
            },
            [props.service, ...(props.args || [])],
        );
    } catch (error) {
        throw filterErrorStack(error);
    }

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
