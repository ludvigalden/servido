import React from "react";

import { useServiceContext, reactServiceContexts } from "./service-react.context";
import { useClearedMemo, uniqueServiceDependent } from "./service-react.hooks";
import { serviceIdentifier, isClass, getClassThunkConstructor } from "./service.fns";
import { ServiceIdentifier, Class, ServiceDependent } from "./service.types";
import { constructService } from "./service.construct";
import { Service } from "./service";
import { requireService } from "./service.require";
import { forgoService } from "./service.forgo";

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

    const provided = useClearedMemo<Provided<S>>(
        () => {
            if (isClass(props.service)) {
                const constructed = context.constructed.get(props.service);

                if (constructed && constructed.has(identifier)) {
                    // construct new and don't add it to the context
                    return {
                        service: constructService<S, any[]>({ service: props.service, args: props.args, context }),
                        deconstruct: true,
                    };
                } else {
                    const dependent = uniqueServiceDependent();

                    return {
                        service: requireService<S, any[]>({ service: props.service, args: props.args, context, dependent }),
                        dependent,
                    };
                }
            } else {
                return { service: props.service };
            }
        },
        (provided) => {
            if (provided.deconstruct) {
                Service.deconstruct(provided.service);
            } else if (provided.dependent) {
                forgoService({ service: provided.service, context, dependent: provided.dependent });
            }
        },
        [props.service, context, identifier],
    );

    return React.createElement(serviceReactContext.Provider, {
        value: provided.service,
        children: props.children,
    });
}

interface Provided<S> {
    deconstruct?: boolean;
    dependent?: ServiceDependent;
    service: S;
}

export interface ServiceProviderProps<S extends Service> {
    service: Class<S, []> | S;
}

export interface ServiceProviderPropsWithArgs<S extends Service, A extends any[]> {
    service: Class<S, A> | S;
    args?: A;
}
