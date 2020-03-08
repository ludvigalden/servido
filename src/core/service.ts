import { requireService } from "./service.require";
import { Class, ServiceIdentifier } from "./service.types";
import { ServiceContext } from "./service.context";
import { forgoService, clearDependent } from "./service.forgo";

/** Describes the interface of a service, but does not provide or utilize any of the described functionalities by itself.
 * In order to make use of a service, it must be required by a dependent, which can be done by a different context using
 * its own `Service.require(Service)`. */
export class Service {
    private _$deconstructFns?: Set<Function>;
    private __context__?: ServiceContext;

    /** The generated identifier for the instance. */
    protected $id?: ServiceIdentifier;

    /** Called once there are no dependents of the Service left and it is to be removed from memory. */
    protected deconstruct(): void {
        return;
    }

    /** Gets a Service using the instance as the dependent, typically to be used inside the `construct` method. */
    protected require<S extends Service>(service: Class<S, []> | S): S;
    protected require<S extends Service, A extends any[]>(service: Class<S, A> | S, ...arguments_: A): S;
    protected require(service: Class<Service> | Service, ...args: any[]): any {
        return requireService({ service, context: this.__context__, dependent: this, args });
    }

    /** Forgos a Service that has previously been required. */
    protected forgo<S extends Service>(service: S) {
        return forgoService({ service, context: this.__context__, dependent: this });
    }

    /** Contains the set of functions that should be called when deconstructing the service. */
    protected get deconstructFns() {
        if (!this._$deconstructFns) {
            this._$deconstructFns = new Set();
        }

        return this._$deconstructFns;
    }

    /** Specifies private properties. */
    static KEY = {
        /** If a `ServiceIdentifier` could be generated when constructing the service, that will be added to the constructed service using this key. */
        ID: "$id" as "$id",
        /** If a context other than the default context was used for the requireing of the service, that will be defined using this key. */
        CONTEXT: "__context__" as "__context__",
    };

    static deconstruct(service: Service) {
        if (service._$deconstructFns) {
            for (const deconstructFn of service._$deconstructFns.values()) {
                deconstructFn();
            }

            service._$deconstructFns.clear();
        }

        service.deconstruct();

        clearDependent({ dependent: service, context: service[Service.KEY.CONTEXT] });
    }

    static require<S extends Service>(service: Class<S, []> | S): S;
    static require<S extends Service, A extends any[]>(service: Class<S, A> | S, ...arguments_: A): S;
    static require(service: Class<Service> | Service, ...args: any[]): any {
        return requireService({ service, dependent: Service, args });
    }

    /** Forgos a Service that has previously been required. */
    static forgo<S extends Service>(service: S) {
        return forgoService({ service, dependent: Service });
    }
}
