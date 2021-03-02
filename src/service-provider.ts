import React from "react";
import { useClearedMemo } from "use-cleared-memo";

import { forgoService } from "./forgo-service";
import { requireService } from "./require-service";
import { Service, ServiceClass, ServiceQuery } from "./service";
import { ServiceContext } from "./service-context";
import { ServiceDependent } from "./service-dependent";
import { parseQuery } from "./service-util";

/** Allows for providing a specific set of default arguments for a service. */
export function ServiceProvider<S extends Service>(props: React.PropsWithChildren<ServiceProviderProps<S>>): JSX.Element;
export function ServiceProvider<S extends Service, A extends any[]>(
    props: React.PropsWithChildren<ServiceProviderPropsWithArgs<S, A>>,
): JSX.Element;
export function ServiceProvider<S extends Service>(props: React.PropsWithChildren<ServiceProviderPropsWithArgs<S, any[]>>) {
    const parentContext = ServiceContext.use();

    const { class: constructor, args } = parseQuery(props.service, props.args);
    const id = parentContext.getId(constructor, args);

    const { context } = useClearedMemo<Provided<S>>(
        () => {
            const context = parentContext.nest(Service.identifier(constructor, id));
            const dependent = new ServiceDependent("ServiceProvider", context);
            context.setDefaultId(constructor, id);
            const service = requireService({ service: props.service, args, id, dependent });
            if (props.proxy) {
                context.setProxy(props.proxy, service);
            }
            if (props.proxies) {
                props.proxies.forEach((proxy) => {
                    context.setProxy(proxy, service);
                });
            }
            return { service, dependent, context };
        },
        (provided) => {
            if (!provided.dependent || provided.context.static) {
                return;
            }
            if (provided.dependent) {
                forgoService({ service: provided.service, dependent: provided.dependent });
            }
        },
        [constructor, id, parentContext, ...(props.deps || [])],
    );

    return React.createElement(ServiceContext.reactContext.Provider, {
        value: context,
        children: props.children,
    });
}

interface Provided<S extends Service> extends Pick<ServiceProviderProps<S>, "proxy" | "proxies"> {
    deconstruct?: boolean;
    dependent?: ServiceDependent;
    service: S;
    context: ServiceContext;
}

export interface ServiceProviderProps<S extends Service> {
    /** The service to provide. */
    service: ServiceQuery<S>;
    /** If a query for the `proxy` should be redirected to the specified `service`. */
    proxy?: ServiceQuery<S>;
    /** If a query for any of the `proxies` should be redirected to the specified `service`. */
    proxies?: ServiceQuery<S>[];
    deps?: readonly any[];
}

export interface ServiceProviderPropsWithArgs<S extends Service, A extends any[]> {
    service: ServiceClass<S, A>;
    args?: A;
    /** If a query for the `proxy` should be redirected to the specified `service`. */
    proxy?: ServiceQuery<S>;
    /** If a query for any of the `proxies` should be redirected to the specified `service`. */
    proxies?: ServiceQuery<S>[];
    deps?: readonly any[];
}
