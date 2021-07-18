import { Service } from "./service";
import { ServiceContext } from "./service-context";
import { parseDataConfig } from "./service-data-util";
import { ServiceDependent } from "./service-dependent";
import { INTERNAL } from "./service-internal";

export function forgoService<S extends Service>(props: ForgoServiceProps<S>) {
    const service = props.service;
    const { context, config, dataStore, globalData, cacheData } = parseDataConfig(service);

    context.deleteRequirement(props.dependent, service);

    if (context.instance.hasDependents(service)) {
        return;
    }

    function clearService() {
        const deconstructFns = INTERNAL.get(service, "deconstructFns");
        if (deconstructFns) {
            Array.from(deconstructFns).forEach((deconstructFn) => typeof deconstructFn === "function" && deconstructFn());
            deconstructFns.clear();
        }

        if (!globalData) {
            dataStore.clearCurrentExecution(service);
        }

        const constructor = context.instance.getConstructor(service);

        context.instance.deleteConstructing(service);
        context.instance.deleteClearId(service);

        if (constructor) {
            context.instance.deleteConstructor(service);
            context.instance.deleteConstructed(constructor, INTERNAL.get(service, "identifier"));
        }

        if (!context.staticData && !globalData && !cacheData) {
            if (dataStore.has(service)) {
                dataStore.delete(service);
            }
        }

        clearDependent(service);
    }

    if (config.timeout !== 0) {
        const clearIdLabel = String(props.dependent) + "(" + clearIdIndex++ + ")";
        const clearId = context.instance.setClearId(service, Symbol(clearIdLabel));
        setTimeout(() => {
            if (context.instance.getClearId(service) === clearId) {
                clearService();
            }
        }, config.timeout || 100);
    } else {
        clearService();
    }
}

let clearIdIndex = 1;

export interface ForgoServiceProps<S extends Service> {
    /** The service to forgo from the dependent. */
    service: S;
    dependent: ServiceDependent;
}

/** Removes all of the requirements of the `dependent`. If any one of the forgone services has no more dependents, it will be deconstructed and removed from memory. */
export function clearDependent(dependent: ServiceDependent) {
    const requirements = ServiceContext.get(dependent).instance.getRequirements(dependent);

    if (requirements) {
        Array.from(requirements).forEach((service) => forgoService({ dependent, service }));
    }

    const execution = INTERNAL.get(dependent, "execution");
    if (execution && !execution.done) {
        execution.setDone();
    }
}

export interface ClearServiceDependentProps {
    dependent: ServiceDependent;
}
