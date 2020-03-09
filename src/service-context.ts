import { Service } from "./service";
import { Class, ServiceDependent, ServiceIdentifier } from "./service.types";

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

    /** Get the `ServiceContext` using a possibly defined argument. */
    static get(context?: ServiceContext) {
        return context || ServiceContext.default;
    }
}

ServiceContext.default = new ServiceContext();
