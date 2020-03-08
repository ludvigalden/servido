import { Servido, requireServido, ServidoContext, forgoServido } from "../src";
import { getClassThunkConstructor, isClass, servidoIdentifier, CircularDependencyError } from "../src/core";

describe("servido core", () => {
    const dependent = 0;
    const context = ServidoContext.get();

    let servidoA: ServidoA;

    it("constructs", () => {
        servidoA = requireServido({ servido: ServidoA, dependent, context });
        expect(servidoA.value).toEqual(2);
    });

    it("populates context", () => {
        const constructed = context.constructed.get(ServidoA);
        const requirements = context.requirements.get(dependent);

        expect(constructed).toBeDefined();
        expect(requirements).toBeDefined();

        expect(context.requirements.get(servidoA)).toBeUndefined();
        expect(context.constructors.get(servidoA)).toEqual(ServidoA);

        if (constructed) {
            const identifier = servidoIdentifier(undefined);
            const servido = constructed.get(identifier);

            expect(servido).toBeDefined();

            if (servido) {
                expect(servido).toEqual(servidoA);
            }
        }

        if (requirements) {
            expect(requirements.size).toEqual(1);
        }
    });

    it("constructs new with different context", () => {
        const newServidoA = requireServido({ servido: ServidoA, dependent, context: new ServidoContext() });
        expect(newServidoA === servidoA).toEqual(false);
    });

    it("checks is-class correctly", () => {
        expect(isClass(ServidoA)).toEqual(true);
        expect(isClass(servidoA)).toEqual(false);
    });

    it("gets constructor correctly", () => {
        expect(getClassThunkConstructor(servidoA)).toEqual(ServidoA);
        expect(getClassThunkConstructor(ServidoA)).toEqual(ServidoA);
    });

    let servidoB: ServidoB;

    it("requires link", () => {
        servidoB = requireServido({ servido: ServidoB, dependent, context });
        expect(getClassThunkConstructor(servidoB.a)).toEqual(ServidoA);
        expect(servidoB.a).toEqual(servidoA);
        expect(context.requirements.get(servidoB)).toContain(servidoA);
        expect(context.requirements.get(dependent)).toContain(servidoB);
    });

    it("throws and clears on circular sync requirements", () => {
        let error: Error | undefined;

        try {
            requireServido({ servido: ServidoY, dependent, context });
        } catch (_error) {
            error = _error;
        }

        expect(error).toBeDefined();
        expect(error instanceof CircularDependencyError).toBe(true);
        expect(context.constructed.get(ServidoX)).toBeUndefined();
        expect(context.constructed.get(ServidoY)).toBeUndefined();
    });

    it("deconstructs", () => {
        servidoA = requireServido({ servido: ServidoA, dependent, context });
        servidoB = requireServido({ servido: ServidoB, dependent, context });

        expect(context.requirements.get(servidoB)).toContain(servidoA);
        expect(context.dependents.get(servidoA)).toContain(servidoB);

        forgoServido({ servido: servidoB, dependent, context });

        expect(context.constructed.get(ServidoB)).toBeUndefined();
        expect(context.requirements.get(servidoB)).toBeUndefined();
        expect(context.dependents.get(servidoA)).not.toContain(servidoB);
        expect(context.constructors.get(servidoB)).toBeUndefined();

        expect(context.requirements.get(dependent)).not.toContain(servidoB);

        expect(context.dependents.get(servidoA)).toContain(dependent);

        forgoServido({ servido: servidoA, dependent, context });

        expect(context.constructed.get(ServidoA)).toBeUndefined();
        expect(context.dependents.get(servidoA)).toBeUndefined();
        expect(context.constructors.get(servidoA)).toBeUndefined();

        expect(context.requirements.get(dependent)).toBeUndefined();

        expect(context.constructed.size).toEqual(0);
    });

    class ServidoA extends Servido {
        value = 1;

        constructor() {
            super();

            this.value = 2;
        }
    }

    class ServidoB extends Servido {
        a: ServidoA;

        constructor() {
            super();

            this.a = this.require(ServidoA);
        }
    }

    class ServidoX extends Servido {
        y: ServidoY;

        constructor() {
            super();

            this.y = this.require(ServidoY);
        }
    }

    class ServidoY extends Servido {
        x: ServidoX;

        constructor() {
            super();

            this.x = this.require(ServidoX);
        }
    }
});
