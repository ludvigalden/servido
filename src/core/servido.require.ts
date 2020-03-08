import { ServidoAsync } from "../async/servido-async";

import { constructServido } from "./servido.construct";
import { ServidoContext } from "./servido.context";
import { Servido } from "./servido";
import { Class, ServidoDependent, ServidoIdentifier } from "./servido.types";
import { isClass, servidoIdentifier, getClassThunkConstructor } from "./servido.util";

export function requireServido<S extends Servido, A extends any[]>(props: RequireServidoProps<S, A>): S;
export function requireServido<S extends Servido>(props: RequireServidoProps<S, []>): S;
export function requireServido(props: RequireServidoProps<Servido, any[]>) {
    const id = servidoIdentifier(props.args);

    if (!isClass(props.servido)) {
        // the servido was passed as an instance and params are OK
        if (id == null || props.servido[Servido.KEY.ID] !== id) {
            // the passed parameters do not match the instance, get prototype and go forward as if the prototype was passed
            props.servido = getClassThunkConstructor(props.servido) as Class<Servido, any[]>;
        } else {
            // the servido was passed as an instance and params are OK
            return props.servido;
        }
    }

    const context = ServidoContext.get(props.context);

    let constructedServidos: Map<ServidoIdentifier, Servido>;

    if (context.constructed.has(props.servido)) {
        constructedServidos = context.constructed.get(props.servido) as Map<ServidoIdentifier, Servido>;
    } else {
        constructedServidos = new Map<ServidoIdentifier, Servido>();
        context.constructed.set(props.servido, constructedServidos);
    }

    let requirements: Set<Servido> | undefined = context.requirements.get(props.dependent);

    if (!requirements) {
        requirements = new Set();
        context.requirements.set(props.dependent, requirements);
    }

    let constructed: Servido;

    if (constructedServidos.has(id)) {
        constructed = constructedServidos.get(id) as Servido;
    } else if (id == null && constructedServidos.size) {
        constructed = constructedServidos.get(constructedServidos.keys().next().value) as Servido;
    } else {
        try {
            constructed = constructServido({ servido: props.servido, context: props.context, args: props.args, id });
            constructedServidos.set(id, constructed);
        } catch (error) {
            if (!constructedServidos.size) {
                context.constructed.delete(props.servido);
            }

            if (!requirements.size) {
                context.requirements.delete(props.dependent);
            }

            if (error instanceof RangeError) {
                throw new CircularDependencyError(`${props.servido.name} is requiring one or more servidos that require itself`);
            } else {
                throw error;
            }
        }
    }

    if (constructed) {
        requirements.add(constructed);

        if (!context.constructors.has(constructed)) {
            context.constructors.set(constructed, props.servido);
        }

        let dependents: Set<ServidoDependent> | undefined = context.dependents.get(constructed);

        if (!dependents) {
            dependents = new Set();
            context.dependents.set(constructed, dependents);
        }

        dependents.add(props.dependent);

        if (constructed instanceof ServidoAsync) {
            if (!context.constructedAsync.has(constructed)) {
                const promise = Promise.resolve().then(() => constructPromise);
                context.constructedAsync.set(constructed, promise);
                const constructPromise = ServidoAsync.constructAsync(constructed);
            }
        }

        if (
            constructed instanceof ServidoAsync &&
            props.dependent !== null &&
            typeof props.dependent === "object" &&
            props.dependent instanceof ServidoAsync
        ) {
            const constructedRequirements = context.requirements.get(constructed);

            if (constructedRequirements && constructedRequirements.has(props.dependent)) {
                let circularRequirements: Set<Servido> | undefined = context.circularRequirements.get(constructed);

                if (!circularRequirements) {
                    circularRequirements = new Set();
                    context.circularRequirements.set(constructed, circularRequirements);
                }

                circularRequirements.add(props.dependent);
            }
        }
    }

    return constructed;
}

interface RequireServidoProps<S extends Servido, A extends any[]> {
    /** The servido */
    servido: S | Class<S, A>;
    dependent: ServidoDependent;
    context?: ServidoContext;
    args?: A;
}

export class CircularDependencyError extends RangeError {}
