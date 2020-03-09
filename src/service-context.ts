import { Service } from "./service";
import { Class, ServiceDependent, ServiceIdentifier } from "./service.types";
import { ServiceContextProvider, useServiceContext } from "./service-react.context";

/** Contains the currently constructed services, dependents and requirements. */
export class ServiceContext {
    readonly constructed = new Map<Class<Service>, Map<ServiceIdentifier, Service>>();
    readonly constructedAsync = new Map<Service, Promise<void>>();
    readonly constructors = new Map<Service, Class<Service>>();
    readonly dependents = new Map<Service, Set<ServiceDependent>>();
    readonly requirements = new Map<ServiceDependent, Set<Service>>();
    readonly circularRequirements = new Map<Service, Set<Service>>();

    /** The default context used when no `ServiceContextProvider` is providing the context. */
    static default: ServiceContext;
    /** Provides the `ServiceContext` for requiring contexts to its children, meaning its children and its children only will be sharing context.
     * If a component using a service is not contained by this provider, it will be sharing context with all other components that are lacking context. */
    static Provider = ServiceContextProvider;

    /** Use the `ServiceContext` provided, or default to the global context that is shared by all other components not being contained by a provider. */
    static use() {
        return useServiceContext();
    }

    /** Get the `ServiceContext` using a possibly defined argument. */
    static get(context?: ServiceContext) {
        return context || ServiceContext.default;
    }
}

ServiceContext.default = new ServiceContext();
