import { Class, ServidoIdentifier } from "./servido.types";
import { servidoIdentifier } from "./servido.util";
import { ServidoContext } from "./servido.context";
import { Servido } from "./servido";

export function constructServido<S extends Servido, A extends any[]>(props: ConstructServidoProps<S, A>): S;
export function constructServido<S extends Servido>(props: ConstructServidoProps<S, []>): S;
export function constructServido(props: ConstructServidoProps<Servido, any[]>) {
    if (props.context != null) {
        // allow for requiring inside the constructor
        Object.defineProperty(props.servido.prototype, Servido.KEY.CONTEXT, {
            value: props.context,
            configurable: true,
            enumerable: false,
        });
    }

    let servido: Servido;

    if (props.args) {
        servido = new props.servido(...props.args);
    } else {
        servido = new props.servido();
    }

    const id = props.args ? servidoIdentifier(props.args) : props.id;

    if (id != null) {
        Object.defineProperty(servido, Servido.KEY.ID, {
            value: id,
            configurable: false,
            writable: false,
            enumerable: false,
        });
    }

    if (props.context != null) {
        Object.defineProperty(servido, Servido.KEY.CONTEXT, {
            value: props.context,
            configurable: false,
            writable: false,
            enumerable: false,
        });
    }

    return servido;
}

interface ConstructServidoProps<S extends Servido, A extends any[]> {
    /** The servido */
    servido: Class<S, A>;
    context?: ServidoContext;
    args?: A;
    id?: ServidoIdentifier;
}
