import { Class, ServiceIdentifier } from "./service.types";
import { serviceIdentifier } from "./service.fns";
import { ServiceContext } from "./service-context";
import { Service } from "./service";

export function constructService<S extends Service, A extends any[]>(props: ConstructServiceProps<S, A>): S;
export function constructService<S extends Service>(props: ConstructServiceProps<S, []>): S;
export function constructService(props: ConstructServiceProps<Service, any[]>) {
    if (props.context != null && props.context !== ServiceContext.default) {
        // allow for requiring inside the constructor
        Object.defineProperty(props.service.prototype, Service.key.context, {
            value: props.context,
            configurable: true,
            enumerable: false,
        });
    }

    const id = props.args ? serviceIdentifier(props.args) : props.id;

    if (id != null) {
        Object.defineProperty(props.service.prototype, Service.key.id, {
            value: id,
            configurable: true,
            enumerable: false,
        });
    }

    let service: Service;

    if (props.args && props.args.length) {
        service = new props.service(...props.args);
    } else {
        service = new props.service();
    }

    if (id != null) {
        delete props.service.prototype[Service.key.id];

        Object.defineProperty(service, Service.key.id, {
            value: id,
            configurable: false,
            writable: false,
            enumerable: false,
        });
    }

    if (props.context != null && props.context !== ServiceContext.default) {
        // remove from prototype as it now will be defined in the instance
        delete props.service.prototype[Service.key.context];

        Object.defineProperty(service, Service.key.context, {
            value: props.context,
            configurable: false,
            writable: false,
            enumerable: false,
        });
    } else {
        delete service[Service.key.context];
    }

    Service.construct(service);

    return service;
}

interface ConstructServiceProps<S extends Service, A extends any[]> {
    /** The service */
    service: Class<S, A>;
    context?: ServiceContext;
    args?: A;
    id?: ServiceIdentifier;
}
