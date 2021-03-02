import { constructService } from "./construct-service";
import { Service, ServiceQuery } from "./service";
import { ServiceContext } from "./service-context";
import { ServiceDependent } from "./service-dependent";
import { INTERNAL } from "./service-internal";
import { ServiceIdentifier } from "./service-types";
import { parseQuery } from "./service-util";

/** Create a dependency of the `service`. If the service accepts arguments, those can be passed using the `args` prop. If no arguments are passed or if there
 * has already been a constructed instance with the same identifiable arguments, that will be preferred over constructing a new instance. */
export function requireService<S extends Service, A extends any[]>(props: RequireServiceProps<S, A>): S;
export function requireService<S extends Service>(props: RequireServiceProps<S, []>): S;
export function requireService(props: RequireServiceProps<Service, any[]>) {
    const context = ServiceContext.get(props.dependent);
    let id: ServiceIdentifier = props.id;
    const { service: serviceInstance, class: service, args } = parseQuery(
        context ? context.parseQuery(props.service) : props.service,
        props.args,
    );
    if (serviceInstance) {
        // the service was passed as an instance, assume params are OK
        return serviceInstance;
    } else if (!service) {
        console.warn("Attempted to require undefined service:", props);
        return undefined;
    }

    if (id === undefined) {
        id = context.getId(service, args);
    }

    let constructed: Service = context.instance.getConstructed(service, id);

    if (!constructed) {
        try {
            constructed = constructService({ service, context, args, id });
            context.instance.setConstructed(service, id, constructed);
        } catch (error) {
            context.instance.deleteConstructed(service, id);
            context.deleteRequirement(props.dependent, constructed); // to ensure the set of requirements is deleted

            throw error;
        }
    } else {
        // if service is currently in the process of being cleared it must now be ensured to be undefined
        // so that the service is not deconstructed
        context.instance.deleteClearId(constructed);
    }

    context.addRequirement(props.dependent, constructed);

    if (INTERNAL.get(constructed, "promise")) {
        const storePromise = Promise.resolve().then(() => constructedPromise);
        context.instance.setConstructing(constructed, storePromise);
        const constructedPromise: Promise<void> | void = INTERNAL.get(constructed, "promise");

        if (props.dependent instanceof Service && INTERNAL.get(props.dependent, "promise")) {
            if (context.instance.hasRequirement(constructed, props.dependent)) {
                context.instance.addCircularRequirement(constructed, props.dependent);
            }
        }
    }

    return constructed;
}

export interface RequireServiceProps<S extends Service, A extends any[]> {
    /** The service */
    service: ServiceQuery<S, A>;
    dependent: ServiceDependent;
    args?: A;
    /** If the service has definitely already been constructed, an identifier can be passed. */
    id?: ServiceIdentifier;
}

export class CircularDependencyError extends RangeError {}
