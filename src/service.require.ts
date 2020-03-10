import { ServiceAsync } from "./service-async";
import { constructService } from "./service.construct";
import { ServiceContext } from "./service-context";
import { Service } from "./service";
import { Class, ServiceDependent, ServiceIdentifier } from "./service.types";
import { isClass, serviceIdentifier, getClassThunkConstructor } from "./service.fns";

/** Create a dependency of the `service`. If the service accepts arguments, those can be passed using the `args` prop. If no arguments are passed or if there
 * has already been a constructed instance with the same identifiable arguments, that will be preferred over constructing a new instance. */
export function requireService<S extends Service, A extends any[]>(props: RequireServiceProps<S, A>): S;
export function requireService<S extends Service>(props: RequireServiceProps<S, []>): S;
export function requireService(props: RequireServiceProps<Service, any[]>) {
    const id = serviceIdentifier(props.args);

    if (!isClass(props.service)) {
        // the service was passed as an instance and params are OK
        if (id != null && props.service[Service.key.id] !== id) {
            // the passed parameters do not match the instance, get prototype and go forward as if the prototype was passed
            props.service = getClassThunkConstructor(props.service) as Class<Service, any[]>;
        } else {
            // the service was passed as an instance and params are OK
            return props.service;
        }
    }

    const context = ServiceContext.get(props.context);

    let constructedServices: Map<ServiceIdentifier, Service>;

    if (context.constructed.has(props.service)) {
        constructedServices = context.constructed.get(props.service) as Map<ServiceIdentifier, Service>;
    } else {
        constructedServices = new Map<ServiceIdentifier, Service>();
        context.constructed.set(props.service, constructedServices);
    }

    let requirements: Set<Service> | undefined = context.requirements.get(props.dependent);

    if (!requirements) {
        requirements = new Set();
        context.requirements.set(props.dependent, requirements);
    }

    let constructed: Service;

    if (constructedServices.has(id)) {
        constructed = constructedServices.get(id) as Service;
    } else if (id == null && constructedServices.size) {
        constructed = constructedServices.get(constructedServices.keys().next().value) as Service;
    } else {
        try {
            constructed = constructService({ service: props.service, context: props.context, args: props.args, id });
            constructedServices.set(id, constructed);
        } catch (error) {
            if (!constructedServices.size) {
                context.constructed.delete(props.service);
            }

            if (!requirements.size) {
                context.requirements.delete(props.dependent);
            }

            if (error instanceof RangeError) {
                throw new CircularDependencyError(`${props.service.name} is requiring one or more services that require itself`);
            } else {
                throw error;
            }
        }
    }

    if (constructed) {
        requirements.add(constructed);

        if (!context.constructors.has(constructed)) {
            context.constructors.set(constructed, props.service);
        }

        let dependents: Set<ServiceDependent> | undefined = context.dependents.get(constructed);

        if (!dependents) {
            dependents = new Set();
            context.dependents.set(constructed, dependents);
        }

        dependents.add(props.dependent);

        if (constructed instanceof ServiceAsync) {
            if (!context.constructedAsync.has(constructed)) {
                const promise = Promise.resolve().then(() => constructPromise);

                context.constructedAsync.set(constructed, promise);

                const constructPromise: Promise<void> | void = ServiceAsync.constructAsync(constructed);
            }
        }

        if (
            constructed instanceof ServiceAsync &&
            props.dependent !== null &&
            typeof props.dependent === "object" &&
            props.dependent instanceof ServiceAsync
        ) {
            const constructedRequirements = context.requirements.get(constructed);

            if (constructedRequirements && constructedRequirements.has(props.dependent)) {
                let circularRequirements: Set<Service> | undefined = context.circularRequirements.get(constructed);

                if (!circularRequirements) {
                    circularRequirements = new Set();
                    context.circularRequirements.set(constructed, circularRequirements);
                }

                circularRequirements.add(props.dependent);
            }
        }
    }

    return constructed;
}

export interface RequireServiceProps<S extends Service, A extends any[]> {
    /** The service */
    service: S | Class<S, A>;
    dependent: ServiceDependent;
    context?: ServiceContext;
    args?: A;
}

export class CircularDependencyError extends RangeError {}
