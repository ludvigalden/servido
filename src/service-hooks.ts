import React from "react";
import { useClearedMemo } from "use-cleared-memo";

import { forgoService } from "./forgo-service";
import { requireService } from "./require-service";
import { Service, ServiceQuery } from "./service";
import { ServiceContext } from "./service-context";
import { ServiceDependent } from "./service-dependent";
import { parseServiceQuery } from "./service-fns";
import { isConstructing } from "./service-util";

/** If the service accepts arguments, those can be passed as additional arguments to the hook. Whenever the passed service or arguments change, a new instance may or may not be constructed.
 * If an instance of the service has been provided by a parent using `ServiceProvider`, that instance will be preferred unless there is a mismatch of arguments. */
export function useService<S extends Service>(service: ServiceQuery<S, [], any[]>): S;
export function useService<S extends Service, QA extends any[]>(service: ServiceQuery<S, [], QA>): S;
export function useService<S extends Service, A extends any[], QA extends any[]>(service: ServiceQuery<S, A, QA>, ...arguments_: A): S;
export function useService<S extends Service>(service: ServiceQuery<S>, ...passedArgs: any[]) {
    const context = ServiceContext.use();
    const { args, constructor, instance } = parseServiceQuery(context.parseQuery(service), passedArgs);
    const id = context.getId(constructor, args);

    return useClearedMemo(
        (): { dependent: ServiceDependent | undefined; service: S } => {
            // service instance passed
            if (instance) {
                return {
                    service: instance,
                    dependent: undefined,
                };
            }

            // allow undefined service
            if (!service) {
                return {
                    dependent: undefined,
                    service: undefined,
                };
            }

            const dependent = new ServiceDependent(undefined, context);

            return {
                dependent,
                service: requireService({ service, dependent, args, id }),
            };
        },
        (previous) => {
            if (!previous.dependent || ServiceContext.get(previous.dependent).static) {
                return;
            }
            forgoService({ service: previous.service, dependent: previous.dependent });
        },
        [constructor, instance, id, context],
    ).service;
}

/** Check if any of the passed services are currently constructing and react to when the construction resolves.
 * The passed services must always be of the same length. */
export function useConstructing(...services: Service[]) {
    const isConstructingRef = React.useRef(true);
    const forceUpdate = useMountedForceUpdate();

    const checking = React.useRef<symbol>();

    React.useMemo(() => {
        const thisChecking = (checking.current = Symbol());
        isConstructingRef.current = isConstructing(...services);

        if (isConstructingRef.current) {
            Service.resolve(...services).then(() => {
                if (checking.current === thisChecking) {
                    isConstructingRef.current = false;
                    forceUpdate();
                }
            });
        }
    }, services);

    return isConstructingRef.current;
}

function useUnsafeForceUpdate(): () => void {
    return React.useReducer(() => Object.create(null), undefined)[1] as any;
}

/**
 * A safe form of force updating a component. The basic quality is to not perform any updates when the component
 * is not unmounted. In addition, it also allows for queueing a update for when the component *has* been mounted,
 * which is simply done by calling the function before the component has been mounted.
 */
function useMountedForceUpdate(): () => void {
    const unsafeForceUpdate = useUnsafeForceUpdate();
    const lifecycle = React.useRef({ queuedUpdate: false, mounted: false, unmounted: false });
    React.useEffect(() => {
        lifecycle.current.mounted = true;
        if (lifecycle.current.queuedUpdate) {
            lifecycle.current.queuedUpdate = false;
            unsafeForceUpdate();
        }
        return () => {
            lifecycle.current.unmounted = true;
        };
    }, []);
    return function mountedForceUpdate() {
        if (lifecycle.current.mounted) {
            if (!lifecycle.current.unmounted) {
                unsafeForceUpdate();
            }
        } else {
            lifecycle.current.queuedUpdate = true;
        }
    };
}
