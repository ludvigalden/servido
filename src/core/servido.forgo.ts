import { ServidoContext } from "./servido.context";
import { Servido } from "./servido";
import { ServidoDependent } from "./servido.types";

export function forgoServido<S extends Servido>(props: ForgoServidoProps<S>) {
    const context = ServidoContext.get(props.context);

    const requirements = context.requirements.get(props.dependent);

    // console.log("FORGO", props.servido, props.dependent);

    if (requirements && requirements.has(props.servido)) {
        requirements.delete(props.servido);

        if (!requirements.size) {
            context.requirements.delete(props.dependent);
        }
    }

    const circularRequirements = context.circularRequirements.get(props.servido);

    const dependents = context.dependents.get(props.servido);

    if (dependents) {
        if (circularRequirements) {
            [...circularRequirements].forEach((circularRequirement) => {
                if (context.constructors.has(circularRequirement)) {
                    const circularRequirementDependents = context.dependents.get(circularRequirement);

                    if (
                        circularRequirementDependents &&
                        (circularRequirementDependents.size > 1 || !circularRequirementDependents.has(props.servido))
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
                context.circularRequirements.delete(props.servido);
            }
        }

        dependents.delete(props.dependent);

        if (!dependents.size) {
            context.dependents.delete(props.servido);
        }
    }

    if (!context.dependents.has(props.servido)) {
        const constructor = context.constructors.get(props.servido);

        if (context.constructedAsync.has(props.servido)) {
            context.constructedAsync.delete(props.servido);
        }

        if (constructor) {
            context.constructors.delete(props.servido);

            const constructed = context.constructed.get(constructor);

            if (constructed) {
                constructed.delete(props.servido[Servido.KEY.ID]);

                if (!constructed.size) {
                    context.constructed.delete(constructor);
                }
            }
        }

        Servido.deconstruct(props.servido);
    }
}

interface ForgoServidoProps<S extends Servido> {
    /** The servido to forgo from the dependent. */
    servido: S;
    dependent: ServidoDependent;
    context?: ServidoContext;
}

export function clearDependent(props: ClearDependentProps) {
    const context = ServidoContext.get(props.context);

    const requirements = context.requirements.get(props.dependent);

    if (requirements) {
        [...requirements].forEach((servido) => forgoServido({ ...props, servido }));
    }
}

interface ClearDependentProps {
    dependent: ServidoDependent;
    context?: ServidoContext;
}
