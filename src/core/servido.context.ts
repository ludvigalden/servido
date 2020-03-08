import { Servido } from "./servido";
import { Class, ServidoDependent, ServidoIdentifier } from "./servido.types";

/** Contains the currently constructed servidos, dependents and requirements. */
export class ServidoContext {
    static default: ServidoContext;

    static get(context?: ServidoContext) {
        return context || ServidoContext.default;
    }

    readonly constructed = new Map<Class<Servido>, Map<ServidoIdentifier, Servido>>();
    readonly constructedAsync = new Map<Servido, Promise<void>>();
    readonly constructors = new Map<Servido, Class<Servido>>();
    readonly dependents = new Map<Servido, Set<ServidoDependent>>();
    readonly requirements = new Map<ServidoDependent, Set<Servido>>();
    readonly circularRequirements = new Map<Servido, Set<Servido>>();
}

ServidoContext.default = new ServidoContext();
