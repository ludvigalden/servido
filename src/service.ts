import { ServiceContext } from "./service-context";
import { ServiceIdentifier, Class } from "./service.types";
import { clearServiceDependent, forgoService } from "./service.forgo";
import { requireService } from "./service.require";

/** The class which all services must extend, allowing for requiring and forgoing other services as well as managing the construct/deconstruct lifecycle. */
export class Service {
    /** The generated identifier for the instance. */
    protected $id?: ServiceIdentifier;

    /** Called once there are no remaining dependents of the service, after calling each of the `deconstructFns`. */
    protected deconstruct(): void {
        return;
    }

    /** Require a service using `this` as the dependent. */
    protected require<S extends Service>(service: Class<S, []> | S): S;
    protected require<S extends Service, A extends any[]>(service: Class<S, A> | S, ...arguments_: A): S;
    protected require(service: Class<Service> | Service, ...args: any[]): any {
        return requireService({ service, context: this[Service.key.context], dependent: this, args });
    }

    /** Forgo service that has previously been required using the `require` method. */
    protected forgo<S extends Service>(service: S) {
        return forgoService({ service, context: this[Service.key.context], dependent: this });
    }

    /** Functions that should be called once there are no remaining dependents of the service and it is to be removed from memory,
     * prior to calling the `deconstruct` method. */
    protected get deconstructFns() {
        if (!this[Service.key.deconstructFns]) {
            Object.defineProperty(this, Service.key.deconstructFns, {
                value: new Set(),
                writable: false,
                configurable: false,
                enumerable: false,
            });
        }

        return this[Service.key.deconstructFns];
    }

    private $context?: ServiceContext;
    private $deconstructFns?: Set<Function>;

    static construct(_service: Service) {}

    static deconstruct(service: Service) {
        if (typeof service.deconstruct === "function") {
            service.deconstruct();
        }

        const deconstructFns = service[Service.key.deconstructFns];

        if (deconstructFns) {
            Array.from(deconstructFns).forEach((deconstructFn) => typeof deconstructFn === "function" && deconstructFn());

            deconstructFns.clear();
        }

        clearServiceDependent({ dependent: service, context: service[Service.key.context] });

        return service;
    }

    /** Private properties of a `Service`. */
    static key = {
        /** If a `ServiceIdentifier` could be generated when constructing the service, that will be added to the constructed service using this key. */
        id: "$id" as "$id",
        /** If a context other than the default context was used for the requireing of the service, that will be defined using this key. */
        context: "$context" as "$context",
        deconstructFns: "$deconstructFns" as "$deconstructFns",
    };
}
