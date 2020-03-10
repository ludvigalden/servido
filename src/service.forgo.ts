import { ServiceContext } from "./service-context";
import { Service } from "./service";
import { ServiceDependent } from "./service.types";

/** Removes the `dependent` from the `service` and the `requirement` of the `service` from the `dependent`.
 * If the forgone service has no more dependents, it will be deconstructed and removed from memory. */
export function forgoService<S extends Service>(props: ForgoServiceProps<S>) {
    const context = ServiceContext.get(props.context);

    const requirements = context.requirements.get(props.dependent);

    // console.log("FORGO", props.service, props.dependent);

    if (requirements && requirements.has(props.service)) {
        requirements.delete(props.service);

        if (!requirements.size) {
            context.requirements.delete(props.dependent);
        }
    }

    const circularRequirements = context.circularRequirements.get(props.service);

    const dependents = context.dependents.get(props.service);

    if (dependents) {
        if (circularRequirements) {
            Array.from(circularRequirements).forEach((circularRequirement) => {
                if (context.constructors.has(circularRequirement)) {
                    const circularRequirementDependents = context.dependents.get(circularRequirement);

                    if (
                        circularRequirementDependents &&
                        (circularRequirementDependents.size > 1 || !circularRequirementDependents.has(props.service))
                    ) {
                        return;
                    }
                }

                if (dependents.has(circularRequirement)) {
                    dependents.delete(circularRequirement);

                    circularRequirements.delete(circularRequirement);
                }
            });

            if (!circularRequirements.size) {
                context.circularRequirements.delete(props.service);
            }
        }

        dependents.delete(props.dependent);

        if (!dependents.size) {
            context.dependents.delete(props.service);
        }
    }

    if (!context.dependents.has(props.service)) {
        const constructor = context.constructors.get(props.service);

        if (context.constructedAsync.has(props.service)) {
            context.constructedAsync.delete(props.service);
        }

        if (constructor) {
            context.constructors.delete(props.service);

            const constructed = context.constructed.get(constructor);

            if (constructed) {
                constructed.delete(props.service[Service.key.id]);

                if (!constructed.size) {
                    context.constructed.delete(constructor);
                }
            }
        }

        Service.deconstruct(props.service);
    }
}

export interface ForgoServiceProps<S extends Service> {
    /** The service to forgo from the dependent. */
    service: S;
    dependent: ServiceDependent;
    context?: ServiceContext;
}

/** Removes all of the requirements of the `dependent`. If any one of the forgone services has no more dependents, it will be deconstructed and removed from memory. */
export function clearServiceDependent(props: ClearServiceDependentProps) {
    const context = ServiceContext.get(props.context);

    const requirements = context.requirements.get(props.dependent);

    if (requirements) {
        Array.from(requirements).forEach((service) => forgoService({ ...props, service }));
    }
}

export interface ClearServiceDependentProps {
    dependent: ServiceDependent;
    context?: ServiceContext;
}
