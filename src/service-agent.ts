import { useClearedMemo } from "use-cleared-memo";

import { clearDependent, forgoService } from "./forgo-service";
import { requireService } from "./require-service";
import { Service, ServiceQuery } from "./service";
import { ServiceDependent } from "./service-dependent";
import { INTERNAL } from "./service-internal";
import { executionOf, useDependent } from "./service-util";

/* A `ServiceAgent` is typically something that works for a service, but needs access to services that the service may not require
or for some reason are not passed down directly to where the service agent is used.  */
export class ServiceAgent extends ServiceDependent {
    constructor(dependent: ServiceDependent) {
        let name = INTERNAL.get(dependent, "name");
        if (name) {
            name = name + "Agent";
        }
        const context = INTERNAL.get(dependent, "context");
        const parentExecution = executionOf(dependent);
        const execution = parentExecution.nest();
        if (execution.done) {
            console.error(
                "Constructed service agent for a dependent with a done execution. Its requirements will never be cleared. Dependent:",
                dependent,
            );
        } else {
            execution.onDone(() => clearDependent(this));
        }
        super(name, context, execution);
    }

    /** Require a service using `this` as the dependent. */
    require<S extends Service, QA extends any[]>(service: ServiceQuery<S, [], QA>): S;
    require<S extends Service, A extends any[], QA extends any[]>(service: ServiceQuery<S, A, QA>, ...arguments_: A): S;
    require(service: ServiceQuery<Service>, ...args: any[]): any {
        return requireService({ service, dependent: this, args });
    }

    /** Forgo service that has previously been required using the `require` method. */
    forgo<S extends Service>(service: S) {
        return forgoService({ service, dependent: this });
    }

    static use(): ServiceAgent {
        return useAgent();
    }

    protected toString() {
        const name = INTERNAL.get(this, "name");
        if (name) {
            return "ServiceAgent(" + name + ")";
        }
        return "ServiceAgent";
    }
}

export function useAgent(dependent: ServiceDependent = useDependent(), deps: readonly any[] = []): ServiceAgent {
    return useClearedMemo(
        () => new ServiceAgent(dependent),
        (agent) => clearDependent(agent),
        [dependent, ...deps],
    );
}
