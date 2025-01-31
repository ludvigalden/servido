import { ServiceConfig } from "./service-config";
import { ServiceDependent } from "./service-dependent";
import { ServiceExecution } from "./service-execution";
import { ServiceConstructorProperty } from "./service-fns";
import { hash } from "./service-identifier";
import { INTERNAL } from "./service-internal";
import { Class, ServiceIdentifier } from "./service-types";

export class Service extends ServiceDependent {
    /** Called once the service instance has been constructed. The passed `execution` will be set done once the service has no more dependents
     * and all of the defined `deconstructFns` have been called. */
    protected asyncConstructor?(execution: ServiceExecution): Promise<any> | void;
    /** Defined to return and specify the service configuration. It can also be defined using the `servido.confgure` utility,
     * but that obviously omits the possibility of specifying types for the service data. */
    protected getServiceConfig?(): ServiceConfig;

    constructor() {
        super();
    }

    /** Functions that should be called once there are no remaining dependents of the service and it is to be removed from memory. */
    protected get deconstructFns() {
        let deconstructFns = INTERNAL.get(this, "deconstructFns");
        if (!deconstructFns) {
            deconstructFns = new Set();
            INTERNAL.defineProperty(this, "deconstructFns", deconstructFns, { writable: false, configurable: false, enumerable: false });
        }
        return deconstructFns;
    }

    protected toString() {
        const name = INTERNAL.get(this, "name") || "Service";
        const id = INTERNAL.get(this, "identifier");
        if (id !== undefined) {
            return name + "(" + String(id) + ")";
        }
        return name;
    }

    /** Generate a `ServiceIdentifier` for a set of passed arguments. A prototype extending `Service` can override the method. */
    static identifier(...args: any[]): ServiceIdentifier {
        if (!args || args.every((arg) => arg === undefined)) {
            return undefined;
        }
        if (args.length <= 1 && (typeof args[0] !== "object" || args[0] === null)) {
            return args[0];
        }
        return hash(args);
    }

    /** Resolve the promise returned by the `asyncConstructor` method of every passed `Service`. */
    static async resolve<S extends (Service | undefined)[]>(...services: S) {
        const servicePromises = services.map((service) => service instanceof Service && INTERNAL.get(service, "promise"));
        return Promise.all(servicePromises).then(() => {
            return services;
        });
    }

    /** The amount of time in ms to wait until finally deconstructing the service. Defaults to `1`, meaning a synchronous switch of dependents will not
     * deconstruct the service, which would not have been the case if it was `0`. */
    static deconstructTimeout = 1;

    /** The key for the data. */
    static get key(): string {
        return INTERNAL.get(this as any, "key" as any);
    }

    /** The key for the data. */
    static set key(key: string) {
        INTERNAL.defineProperty(this as any, "key" as any, key, { enumerable: false, configurable: true, writable: true });
    }
}

Object.defineProperty(Service, ServiceConstructorProperty, { value: true, writable: false, enumerable: false, configurable: false });

export interface ServiceConstructor<S extends Service = Service, A extends any[] = any[]> extends Class<S, A> {
    /** Generate a `ServiceIdentifier` for a set of passed arguments */
    identifier?(...args: A): ServiceIdentifier;
    /** The amount of time in ms to wait until finally deconstructing the service. Defaults to `1`, meaning a synchronous switch of dependents will not
     * deconstruct the service, which would not have been the case if it was `0`. */
    deconstructTimeout?: number;
    /** The key for the data. */
    key?: string;
}

export type ServiceQuery<S extends Service, A extends any[] = any[], QA extends any[] = any[]> =
    | S
    | Class<S, A>
    | ServiceSource<S, A>
    | [service: ServiceType<S, QA>, ...arguments: QA]
    | [service: Class<S, QA>, ...arguments: QA]
    | [service: ServiceSource<S, QA>, ...arguments: QA];

export type ServiceType<S extends Service, A extends any[] = any[]> = Class<S, A> | ServiceSource<S, A>;

export interface ServiceSource<S extends Service = Service, A extends any[] = any[]> {
    getService?(...args: A): ServiceQuery<S, A>;
    service?: ServiceQuery<S, A>;
}
