import { ServiceAsync } from "./service-async";
import { ServiceContext } from "./service-context";
import { ServiceContextProvider, useServiceContext } from "./service-react.context";
import { useService, useConstructing, uniqueServiceDependent } from "./service-react.hooks";
import { ServiceProvider } from "./service-react.provider";
import { requireService, RequireServiceProps } from "./service.require";
import { serviceIdentifier } from "./service.fns";
import { forgoService, ForgoServiceProps, clearServiceDependent, ClearServiceDependentProps } from "./service.forgo";
import { Service } from "./service";
import { Class, ServiceIdentifier } from "./service.types";
import { constructingServices, resolveServices } from "./service.util";

/** Provides the exports of `servido`. */
export class servido {
    /** The class which all services must extend, allowing for requiring and forgoing other services as well as managing the construct/deconstruct lifecycle. */
    static Service = Service;
    /** The class which all asynchronous and circularly-requiring services must extend. The promise returned by the `constructorAsync` method will define the constructing status. */
    static ServiceAsync = ServiceAsync;
    /** Constructs and provides a `service` to its children, no matter if it has already been constructed in the context. Does not add the instance to the relevant `ServiceContext`. */
    static Provider = ServiceProvider;
    /** Contains the currently constructed services, dependents and requirements. */
    static Context = ServiceContext;
    /** Provides the `ServiceContext` for requiring contexts to its children, meaning its children and its children only will be sharing context.
     * If a component using a service is not contained by this provider, it will be sharing context with all other components that are lacking context. */
    static ContextProvider: typeof ServiceContextProvider;

    /** If the service accepts arguments, those can be passed as additional arguments to the hook. Whenever the passed service or arguments change, a new instance may or may not be constructed.
     * If an instance of the service has been provided by a parent using `ServiceProvider`, that instance will be preferred unless there is a mismatch of arguments. */
    static use<S extends Service>(service: Class<S, []> | S): S;
    static use<S extends Service, A extends any[]>(service: Class<S, A> | S, ...arguments_: A): S;
    static use<S extends Service>(service: Class<S> | S, ...args: any[]) {
        return useService(service, ...args);
    }

    /** Create a dependency of the `service`. If the service accepts arguments, those can be passed using the `args` prop. If no arguments are passed or if there
     * has already been a constructed instance with the same identifiable arguments, that will be preferred over constructing a new instance. */
    static require<S extends Service, A extends any[]>(props: RequireServiceProps<S, A>): S;
    static require<S extends Service>(props: RequireServiceProps<S, []>): S;
    static require(props: RequireServiceProps<Service, any>) {
        return requireService(props);
    }

    /** Removes the `dependent` from the `service` and the `requirement` of the `service` from the `dependent`.
     * If the forgone service has no more dependents, it will be deconstructed and removed from memory. */
    static forgo<S extends Service>(props: ForgoServiceProps<S>) {
        return forgoService(props);
    }

    /** Removes all of the requirements of the `dependent`. If any one of the forgone services has no more dependents, it will be deconstructed and removed from memory. */
    static clearDependent(props: ClearServiceDependentProps) {
        return clearServiceDependent(props);
    }

    /** Check if any of the passed services are currently constructing and react to when the construction resolves. */
    static useConstructing(...services: Service[]) {
        return useConstructing(...services);
    }

    /** Use the `ServiceContext` provided, or default to the global context that is shared by all other components not being contained by a provider. */
    static useContext() {
        return useServiceContext();
    }

    /** Resolve the promise returned by the `constructorAsync` method of every passed `ServiceAsync`. */
    static resolve<S extends (Service | undefined)[]>(...services: S) {
        return resolveServices(...services);
    }

    /** Generate a `ServiceIdentifier` for a set of passed arguments. */
    static identifier<A extends any[]>(args: A | undefined): ServiceIdentifier {
        return serviceIdentifier(args);
    }

    /** Check if any of the passed services are currently constructing. */
    static constructing(...services: Service[]): boolean {
        return constructingServices(...services);
    }

    /** Get a string that can be safely assumed to be unique among service dependents. */
    static uniqueDependent() {
        return uniqueServiceDependent();
    }
}
