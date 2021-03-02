import React from "react";
import { useClearedMemo } from "use-cleared-memo";

import { clearServiceDependent } from "./forgo-service";
import { requireService } from "./require-service";
import { Service, ServiceClass, ServiceQuery, ServiceSource, ServiceType } from "./service";
import { ServiceConfig } from "./service-config";
import { ServiceContext } from "./service-context";
import { ServiceDependent } from "./service-dependent";
import { ServiceExecution } from "./service-execution";
import { ModuleThunk, isPromise, isServiceClass, resolveModuleThunk } from "./service-fns";
import { INTERNAL } from "./service-internal";
import { Class, ServiceIdentifier } from "./service-types";

/** Check if any of the passed services are currently constructing. */
export function isConstructing(...services: (Service | undefined)[]): boolean {
    return services.some((service) => service instanceof Service && INTERNAL.get(service, "constructing"));
}

/** Check if the passed service is deconstructed and not in use. */
export function isDeconstructed(service: Service): boolean {
    const execution = INTERNAL.get(service, "execution");
    if (!execution) {
        return false;
    }
    return execution.done;
}

/** Returns the execution of a service or service dependent (or defines and returns it if undefined). */
export function executionOf(dependent: ServiceDependent): ServiceExecution {
    if (!dependent) {
        return undefined;
    }
    let execution = INTERNAL.get(dependent, "execution");
    if (!execution) {
        execution = new ServiceExecution();
        INTERNAL.defineProperty(dependent, "execution", execution, { configurable: false, writable: false, enumerable: false });
    }
    return execution;
}

/** Returns the params for the service context. */
export function useParams(): servido.Params {
    return ServiceContext.use().params;
}

/** Returns the params for the service context of the specified dependent. */
export function paramsOf(dependent: ServiceDependent): servido.Params {
    return contextOf(dependent).params;
}

export function useDependent(name?: string, deps: readonly any[] = []): ServiceDependent {
    const context = ServiceContext.use();
    return useClearedMemo(
        () => new ServiceDependent(name, context),
        (dependent) => clearServiceDependent(dependent),
        [context, ...deps],
    );
}

/** Create a query for a service. Useful for typings. */
export function serviceQuery<S extends Service>(service: S | ServiceType<S, []>): ServiceQuery<S, [], []>;
export function serviceQuery<S extends Service, A extends any[]>(service: S | ServiceType<S, A>, ...args: A): ServiceQuery<S, [], A>;
export function serviceQuery<S extends Service, A extends any[], QA extends any[]>(
    query: ServiceQuery<S, A, QA>,
    ...args: A
): ServiceQuery<S, QA, A>;
export function serviceQuery<S extends Service, A extends any[], QA extends any[]>(
    query: ServiceQuery<S, A, QA>,
    ...args: A
): ServiceQuery<S, QA, A> {
    if (Array.isArray(query)) {
        return query as any;
    } else if (args.length) {
        return [query, ...args] as any;
    } else {
        return query as any;
    }
}

/** Create a async query for a service. Useful for typings. */
export async function asyncServiceQuery<S extends Service, A extends any[]>(
    service: AsyncServiceQuery<S, A, []>,
    ...args: A
): Promise<ServiceQuery<S, [], A>>;
export async function asyncServiceQuery<S extends Service>(service: AsyncServiceQuery<S, [], []>): Promise<ServiceQuery<S, [], []>>;
export async function asyncServiceQuery<S extends Service, A extends any[], QA extends any[]>(
    query: AsyncServiceQuery<S, A, QA>,
    ...args: A
): Promise<ServiceQuery<S, QA, A>>;
export async function asyncServiceQuery<S extends Service, A extends any[], QA extends any[]>(
    query: AsyncServiceQuery<S, A, QA>,
    ...args: A
): Promise<ServiceQuery<S, QA, A>> {
    if (isPromise(query)) {
        return (query as any).then((query: any) => {
            if (typeof query !== "function") {
                query = resolveModuleThunk(query);
            }
            return serviceQuery(query, ...args) as any;
        });
    } else if (Array.isArray(query) && isPromise(query[0])) {
        return (query[0] as any).then((v: any) => {
            if (typeof v !== "function") {
                v = resolveModuleThunk(v);
            }
            return serviceQuery([v, ...query.slice(1)], ...args);
        });
    } else {
        return serviceQuery(query as any, ...args) as any;
    }
}

export type AsyncServiceQuery<S extends Service, A extends any[] = any[], QA extends any[] = any[]> =
    | ServiceQuery<S, A, QA>
    | Promise<ModuleThunk<ServiceQuery<S, A, QA>>>
    | Promise<ModuleThunk<ServiceType<S, A>>>
    | Promise<ModuleThunk<Class<S, A>>>
    | Promise<ModuleThunk<ServiceSource<S, A>>>
    | [Promise<ModuleThunk<ServiceType<S, QA>>>, ...QA]
    | [Promise<ModuleThunk<Class<S, QA>>>, ...QA]
    | [Promise<ModuleThunk<ServiceSource<S, QA>>>, ...QA];

/** Returns a function returning a promise that resolves once all of the passed services have been resolved (using `Service.resolve`). */
export function useHandler<A extends any[], S extends Service, T>(
    service: AsyncServiceQuery<S, []> | ((...args: A | []) => AsyncServiceQuery<S, A>),
    handler: (service: S, ...args: A) => T | Promise<T>,
): (...args: A) => Promise<T> {
    const dependent = useDependent("useHandler");
    return React.useCallback(
        async (...args: A): Promise<T> => {
            const serviceQuery = await ((): Promise<ServiceQuery<S>> => {
                if (typeof service === "function" && !isServiceClass(service)) {
                    return asyncServiceQuery((service as any)(...args));
                } else {
                    return asyncServiceQuery(service);
                }
            })();

            if (!serviceQuery) {
                console.error("servido.userHandler: Received undefined query", {
                    serviceQuery,
                    serviceQueryArgument: service,
                    resolvedServiceArg: typeof service === "function" && !isServiceClass(service) && service(...args),
                    handler,
                });
                return;
            }

            const requiredService = requireService({ service: serviceQuery, dependent });

            await Service.resolve(requiredService);

            const value = await handler(requiredService, ...args);

            if (!ServiceContext.get(dependent).static) {
                setTimeout(() => {
                    clearServiceDependent(dependent);
                }, 1);
            }

            return value;
        },
        [dependent, service],
    );
}

/** Returns a function returning a promise that resolves once all of the passed services have been resolved (using `Service.resolve`). */
export function useResolver<A extends any[]>(
    ...services: (AsyncServiceQuery<Service, []> | ((...args: A | []) => AsyncServiceQuery<Service>))[]
): (...args: A) => Promise<void> {
    const dependent = useDependent("useResolver");
    return React.useCallback(
        async (...args) => {
            const resolvedServices: ServiceQuery<Service>[] = await Promise.all(
                services.map(
                    async (service): Promise<ServiceQuery<Service>> => {
                        if (typeof service === "function" && !isServiceClass(service)) {
                            return asyncServiceQuery((service as any)(...args));
                        } else {
                            return asyncServiceQuery(service);
                        }
                    },
                ),
            );
            await Service.resolve(
                ...resolvedServices.map(
                    (service): Service => {
                        return requireService({ service, dependent });
                    },
                ),
            );
            if (!ServiceContext.get(dependent).static) {
                setTimeout(() => {
                    clearServiceDependent(dependent);
                }, 5000);
            }
        },
        [dependent, ...services],
    );
}

/** Returns a function returning a promise that resolves once all of the passed services have been resolved (using `Service.resolve`). */
export function useExecutionResolver<A extends any[]>(
    execution: Pick<ServiceExecution, "done" | "onDone"> | ((...args: A | []) => Pick<ServiceExecution, "done" | "onDone">),
    ...services: (AsyncServiceQuery<Service, []> | ((...args: A | []) => AsyncServiceQuery<Service>))[]
): (...args: A) => Promise<void> {
    const dependent = useDependent("useResolver");
    return React.useCallback(
        async (...args) => {
            const gottenExecution = typeof execution === "function" ? execution(...args) : execution;
            if (gottenExecution.done) {
                return;
            }
            const resolvedServices: ServiceQuery<Service>[] = await Promise.all(
                services.map(
                    async (service): Promise<ServiceQuery<Service>> => {
                        if (typeof service === "function" && !isServiceClass(service)) {
                            return asyncServiceQuery((service as any)(...args));
                        } else {
                            return asyncServiceQuery(service);
                        }
                    },
                ),
            );
            if (gottenExecution.done) {
                return;
            }
            gottenExecution.onDone(() => {
                if (!ServiceContext.get(dependent).static) {
                    setTimeout(() => {
                        clearServiceDependent(dependent);
                    }, 1000);
                }
            });
            await Service.resolve(
                ...resolvedServices.map(
                    (service): Service => {
                        return requireService({ service, dependent });
                    },
                ),
            );
            if (gottenExecution.done) {
                return;
            }
            // stopListeningOnDone();
            // if (!ServiceContext.get(dependent).static) {
            //     setTimeout(() => {
            //         console.log("servido.useExecutionResolver: Timeout done, clearing dependent.");
            //         clearServiceDependent(dependent);
            //     }, 1000);
            // }
        },
        [dependent, ...services],
    );
}

export function parseQuery<S extends Service, A extends any[]>(
    service: ServiceQuery<S, A>,
    args?: A,
): { class: ServiceClass<S, A>; service?: S; args?: A } {
    if (!service) {
        return { class: undefined, args };
    }
    if (Array.isArray(service)) {
        args = service.slice(1) as any;
        service = service[0] as any;
    }
    if (isServiceClass(service)) {
        return { class: service as ServiceClass<S, A>, args };
    } else if (service instanceof Service) {
        const prototype = Object.getPrototypeOf(service);
        return { class: prototype.constructor || prototype, service, args };
    } else if (service["getService"]) {
        return parseQuery<S, A>(service["getService"](...((args || []) as A)), args);
    } else if (service["service"]) {
        return parseQuery<S, A>(service["service"], args);
    } else if (typeof service === "function") {
        return parseQuery<S, A>((service as any)(...((args || []) as A)), args);
    }
    console.error("Unable to resolve class for service ", service);
    return { class: Service as any };
}

/** Returns whether the `query` matches the `matchesQuery`. */
export function doesQueryMatch(
    serviceOrContext: Service | ServiceContext,
    query: ServiceQuery<Service>,
    matchesQuery: ServiceQuery<Service>,
): boolean {
    const parsedQuery = parseQuery(query);
    const parsedMatchesQuery = parseQuery(matchesQuery);
    if (parsedQuery.class !== parsedMatchesQuery.class) {
        return false;
    }
    const context = serviceOrContext instanceof ServiceContext ? serviceOrContext : contextOf(serviceOrContext);
    const queryId = parsedQuery.service ? identifierOf(parsedQuery.service) : context.getId(parsedQuery.class, parsedQuery.args);
    const matchesQueryId = parsedMatchesQuery.service
        ? identifierOf(parsedMatchesQuery.service)
        : context.getId(parsedMatchesQuery.class, parsedMatchesQuery.args);
    if (queryId === matchesQueryId) {
        return true;
    } else if (queryId === undefined) {
        return true;
    }
    return false;
}

export function identifierOf<S extends Service>(service: S): ServiceIdentifier | undefined {
    return INTERNAL.get(service, "identifier");
}

export function identifierFor<A extends any[]>(
    context: ServiceContext,
    query: ServiceQuery<Service, A>,
    args?: A,
): ServiceIdentifier | undefined;
export function identifierFor<A extends any[]>(
    contextOf: Service,
    query: ServiceQuery<Service, A>,
    args?: A,
): ServiceIdentifier | undefined;
export function identifierFor(
    serviceOrContext: Service | ServiceContext,
    query: ServiceQuery<Service>,
    args?: any[],
): ServiceIdentifier | undefined {
    const context = serviceOrContext instanceof ServiceContext ? serviceOrContext : contextOf(serviceOrContext);
    const parsedQuery = parseQuery(query, args);
    if (parsedQuery.service) {
        return identifierOf(parsedQuery.service);
    } else if (parsedQuery.class) {
        return context.getId(parsedQuery.class, parsedQuery.args);
    }
    return undefined;
}

export function contextOf<S extends ServiceDependent>(service: S): ServiceContext {
    return INTERNAL.get(service, "context") || ServiceContext.default;
}

export function configOf<S extends Service>(service: S): ServiceConfig<DataOf<S>> | undefined;
export function configOf<DT>(service: Service): ServiceConfig<DT> | undefined;
export function configOf(service: Service): ServiceConfig | undefined {
    return INTERNAL.get(service, "config");
}

/** Returns whether the context of the specified service contains an active instance of the specified service query. */
export function hasInstance<A extends any[]>(context: ServiceContext, query: ServiceQuery<Service, A>, args?: A): boolean;
export function hasInstance<A extends any[]>(contextOf: ServiceDependent, query: ServiceQuery<Service, A>, args?: A): boolean;
export function hasInstance(serviceOrContext: ServiceDependent | ServiceContext, query: ServiceQuery<Service>, args?: any[]): boolean {
    const context = serviceOrContext instanceof ServiceContext ? serviceOrContext : contextOf(serviceOrContext);
    const instances = context.instance;
    const parsedHas = parseQuery(query, args);
    if (parsedHas.service) {
        return instances.has(parsedHas.service);
    } else if (parsedHas.class) {
        const id = context.getId(parsedHas.class, parsedHas.args);
        return instances.hasConstructed(parsedHas.class, id);
    }
    return false;
}

export function configure<DT = any>(service: Service, config: ServiceConfig<DT>) {
    INTERNAL.set(service, "config", config);
}

/** Requires services until the handler has finished. */
export function handle<RT, RS extends Service>(
    dependent: ServiceDependent | ServiceContext,
    requirement: ServiceQuery<RS>,
    handler: (service: RS, execution: ServiceExecution) => RT | PromiseLike<RT>,
    execution?: ServiceExecution,
): Promise<RT>;
export async function handle(
    forDependentOrContext: ServiceDependent | ServiceContext,
    requires: Record<string, ServiceQuery<Service>> | ServiceQuery<Service>,
    handler: (parsedRequires: Record<string, Service> | Service, execution: ServiceExecution) => any,
    explicitExecution?: ServiceExecution,
): Promise<any> {
    const { parsedRequires, execution, onDone } = parseHandle(forDependentOrContext, requires, explicitExecution);
    try {
        const returnValue = await handler(parsedRequires, execution);
        return returnValue;
    } finally {
        onDone();
    }
}

export function handleSync<RT, RS extends Service>(
    dependent: ServiceDependent | ServiceContext,
    requirement: ServiceQuery<RS>,
    handler: (service: RS) => RT,
    execution?: ServiceExecution,
): RT;
export function handleSync(
    forDependentOrContext: ServiceDependent | ServiceContext,
    requires: Record<string, ServiceQuery<Service>> | ServiceQuery<Service>,
    handler: (parsedRequires: Record<string, Service> | Service) => any,
    explicitExecution?: ServiceExecution,
): any {
    const { parsedRequires, onDone } = parseHandle(forDependentOrContext, requires, explicitExecution);
    try {
        const returnValue = handler(parsedRequires);
        return returnValue;
    } finally {
        onDone();
    }
}

function parseHandle(
    forDependentOrContext: ServiceDependent | ServiceContext,
    requires: Record<string, ServiceQuery<Service>> | ServiceQuery<Service>,
    explicitExecution?: ServiceExecution,
) {
    let context: ServiceContext;
    let execution: ServiceExecution;
    if (forDependentOrContext instanceof ServiceContext) {
        context = forDependentOrContext;
    } else {
        if (!forDependentOrContext) {
            context = ServiceContext.default;
        } else {
            context = contextOf(forDependentOrContext);
            execution = executionOf(forDependentOrContext).nest();
        }
    }
    if (explicitExecution) {
        if (execution) {
            execution = ServiceExecution.nestMany([execution, explicitExecution]);
        } else {
            execution = explicitExecution;
        }
    } else if (!execution) {
        execution = new ServiceExecution();
    }
    const dependent = new ServiceDependent("Handle(" + String(forDependentOrContext) + ")", context);

    let parsedRequires: Record<string, Service> | Service;
    if (requires) {
        if (isQuery(requires)) {
            parsedRequires = requireService({ service: requires, dependent });
        } else {
            parsedRequires = {};
            Object.keys(requires).forEach((key) => {
                parsedRequires[key] = requireService({ service: requires[key], dependent });
            });
        }
    }
    execution.onDone(() => clearServiceDependent(dependent));
    return {
        context,
        execution,
        dependent,
        parsedRequires,
        onDone: () => execution.setDone(),
    };
}

export function isQuery<T extends Service, A extends any[]>(query: any): query is ServiceQuery<T, A> {
    try {
        parseQuery(query);
        return true;
    } catch (_) {
        return false;
    }
}

type DataOf<S extends Service> = S extends {
    getServiceConfig(): ServiceConfig<infer T>;
}
    ? T
    : S extends {
          serviceConfig: ServiceConfig<infer T>;
      }
    ? T
    : any;
