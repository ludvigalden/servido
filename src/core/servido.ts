import { requireServido } from "./servido.require";
import { Class, ServidoIdentifier } from "./servido.types";
import { ServidoContext } from "./servido.context";
import { forgoServido, clearDependent } from "./servido.forgo";

/** Describes the interface of a servido, but does not provide or utilize any of the described functionalities by itself.
 * In order to make use of a servido, it must be required by a dependent, which can be done by a different context using
 * its own `Servido.require(Servido)`. */
export class Servido {
    private _$deconstructFns?: Set<Function>;
    private _$context?: ServidoContext;

    /** The generated identifier for the instance. */
    protected $id?: ServidoIdentifier;

    /** Called once there are no dependents of the Servido left and it is to be removed from memory. */
    protected deconstruct(): void {
        return;
    }

    /** Gets a Servido using the instance as the dependent, typically to be used inside the `construct` method. */
    protected require<S extends Servido>(servido: Class<S, []> | S): S;
    protected require<S extends Servido, A extends any[]>(servido: Class<S, A> | S, ...arguments_: A): S;
    protected require(servido: Class<Servido> | Servido, ...args: any[]): any {
        return requireServido({ servido, context: this._$context, dependent: this, args });
    }

    /** Forgos a Servido that has previously been required. */
    protected forgo<S extends Servido>(servido: S) {
        return forgoServido({ servido, context: this._$context, dependent: this });
    }

    /** Contains the set of functions that should be called when deconstructing the servido. */
    protected get deconstructFns() {
        if (!this._$deconstructFns) {
            this._$deconstructFns = new Set();
        }

        return this._$deconstructFns;
    }

    /** Specifies private properties. */
    static KEY = {
        /** If a `ServidoIdentifier` could be generated when constructing the servido, that will be added to the constructed servido using this key. */
        ID: "$id" as "$id",
        /** If a context other than the default context was used for the requireing of the servido, that will be defined using this key. */
        CONTEXT: "_$context" as "_$context",
    };

    static deconstruct(servido: Servido) {
        if (servido._$deconstructFns) {
            for (const deconstructFn of servido._$deconstructFns.values()) {
                deconstructFn();
            }

            servido._$deconstructFns.clear();
        }

        servido.deconstruct();

        clearDependent({ dependent: servido, context: servido[Servido.KEY.CONTEXT] });
    }

    static require<S extends Servido>(servido: Class<S, []> | S): S;
    static require<S extends Servido, A extends any[]>(servido: Class<S, A> | S, ...arguments_: A): S;
    static require(servido: Class<Servido> | Servido, ...args: any[]): any {
        return requireServido({ servido, dependent: Servido, args });
    }

    /** Forgos a Servido that has previously been required. */
    static forgo<S extends Servido>(servido: S) {
        return forgoServido({ servido, dependent: Servido });
    }
}
