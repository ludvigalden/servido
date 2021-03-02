import { forgoService } from "./forgo-service";
import { requireService } from "./require-service";
import { Service, ServiceQuery } from "./service";
import { ServiceContext } from "./service-context";
import { ServiceExecution } from "./service-execution";
import { INTERNAL } from "./service-internal";

// A ServiceDependent is something that can require services.
export class ServiceDependent {
    constructor(name?: string, context?: ServiceContext, execution?: ServiceExecution) {
        if (name) {
            INTERNAL.defineProperty(this, "name", name, { configurable: false, writable: false, enumerable: false });
        }
        if (execution) {
            INTERNAL.defineProperty(this, "execution", execution, { configurable: false, writable: false, enumerable: false });
        }
        if (context && context !== ServiceContext.default) {
            INTERNAL.defineProperty(this, "context", context, { configurable: false, writable: false, enumerable: false });
        }
    }

    /** Require a service using `this` as the dependent. */
    protected require<S extends Service, QA extends any[]>(service: ServiceQuery<S, [], QA>): S;
    protected require<S extends Service, A extends any[], QA extends any[]>(service: ServiceQuery<S, A, QA>, ...arguments_: A): S;
    protected require(service: ServiceQuery<Service>, ...args: any[]): any {
        return requireService({ service, dependent: this, args });
    }

    /** Forgo service that has previously been required using the `require` method. */
    protected forgo<S extends Service>(service: S) {
        return forgoService({ service, dependent: this });
    }

    protected toString() {
        const name = INTERNAL.get(this, "name");
        if (name) {
            return "ServiceDependent(" + name + ")";
        }
        return "ServiceDependent";
    }
}
