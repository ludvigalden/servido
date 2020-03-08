import { Class, ServiceIdentifier } from "./service.types";
import { serviceIdentifier } from "./service.util";
import { ServiceContext } from "./service.context";
import { Service } from "./service";

export function constructService<S extends Service, A extends any[]>(props: ConstructServiceProps<S, A>): S;
export function constructService<S extends Service>(props: ConstructServiceProps<S, []>): S;
export function constructService(props: ConstructServiceProps<Service, any[]>) {
    if (props.context != null && props.context !== ServiceContext.default) {
        // allow for requiring inside the constructor
        Object.defineProperty(props.service.prototype, Service.KEY.CONTEXT, {
            value: props.context,
            configurable: true,
            enumerable: false,
        });
    }

    let service: Service;

    if (props.args) {
        service = new props.service(...props.args);
    } else {
        service = new props.service();
    }

    const id = props.args ? serviceIdentifier(props.args) : props.id;

    if (id != null) {
        Object.defineProperty(service, Service.KEY.ID, {
            value: id,
            configurable: false,
            writable: false,
            enumerable: false,
        });
    }

    if (props.context != null && props.context !== ServiceContext.default) {
        // remove from prototype as it now will be defined in the instance
        delete props.service.prototype[Service.KEY.CONTEXT];

        Object.defineProperty(service, Service.KEY.CONTEXT, {
            value: props.context,
            configurable: false,
            writable: false,
            enumerable: false,
        });
    }

    return service;
}

interface ConstructServiceProps<S extends Service, A extends any[]> {
    /** The service */
    service: Class<S, A>;
    context?: ServiceContext;
    args?: A;
    id?: ServiceIdentifier;
}
