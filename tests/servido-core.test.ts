import servido, { Service, CircularDependencyError } from "../src";
import { isClass, getClassThunkConstructor, serviceIdentifier } from "../src/service.fns";

describe("service core", () => {
    const dependent = 0;
    const context = servido.Context.get();

    let serviceA: ServiceA;

    it("constructs", () => {
        serviceA = servido.require({ service: ServiceA, dependent, context });
        expect(serviceA.value).toEqual(2);
    });

    it("populates context", () => {
        const constructed = context.constructed.get(ServiceA);
        const requirements = context.requirements.get(dependent);

        expect(constructed).toBeDefined();
        expect(requirements).toBeDefined();

        expect(context.requirements.get(serviceA)).toBeUndefined();
        expect(context.constructors.get(serviceA)).toEqual(ServiceA);

        if (constructed) {
            const identifier = servido.identifier(undefined);
            const service = constructed.get(identifier);

            expect(service).toBeDefined();

            if (service) {
                expect(service).toEqual(serviceA);
            }
        }

        if (requirements) {
            expect(requirements.size).toEqual(1);
        }
    });

    it("constructs new with different context", () => {
        const newServiceA = servido.require({ service: ServiceA, dependent, context: new servido.Context() });
        expect(newServiceA === serviceA).toEqual(false);
    });

    it("checks is-class correctly", () => {
        expect(isClass(ServiceA)).toEqual(true);
        expect(isClass(serviceA)).toEqual(false);
    });

    it("gets constructor correctly", () => {
        expect(getClassThunkConstructor(serviceA)).toEqual(ServiceA);
        expect(getClassThunkConstructor(ServiceA)).toEqual(ServiceA);
    });

    let serviceB: ServiceB;

    it("requires link", () => {
        serviceB = servido.require({ service: ServiceB, dependent, context });
        expect(getClassThunkConstructor(serviceB.a)).toEqual(ServiceA);
        expect(serviceB.a).toEqual(serviceA);
        expect(context.requirements.get(serviceB)).toContain(serviceA);
        expect(context.requirements.get(dependent)).toContain(serviceB);
    });

    it("throws and clears on circular sync requirements", () => {
        let error: Error | undefined;

        try {
            servido.require({ service: ServiceY, dependent, context });
        } catch (_error) {
            error = _error;
        }

        expect(error).toBeDefined();
        expect(error instanceof CircularDependencyError).toBe(true);
        expect(context.constructed.get(ServiceX)).toBeUndefined();
        expect(context.constructed.get(ServiceY)).toBeUndefined();
    });

    it("deconstructs", () => {
        serviceA = servido.require({ service: ServiceA, dependent, context });
        serviceB = servido.require({ service: ServiceB, dependent, context });

        expect(context.requirements.get(serviceB)).toContain(serviceA);
        expect(context.dependents.get(serviceA)).toContain(serviceB);

        servido.forgo({ service: serviceB, dependent, context });

        expect(context.constructed.get(ServiceB)).toBeUndefined();
        expect(context.requirements.get(serviceB)).toBeUndefined();
        expect(context.dependents.get(serviceA)).not.toContain(serviceB);
        expect(context.constructors.get(serviceB)).toBeUndefined();

        expect(context.requirements.get(dependent)).not.toContain(serviceB);

        expect(context.dependents.get(serviceA)).toContain(dependent);

        servido.forgo({ service: serviceA, dependent, context });

        expect(context.constructed.get(ServiceA)).toBeUndefined();
        expect(context.dependents.get(serviceA)).toBeUndefined();
        expect(context.constructors.get(serviceA)).toBeUndefined();

        expect(context.requirements.get(dependent)).toBeUndefined();

        expect(context.constructed.size).toEqual(0);
    });

    class ServiceA extends Service {
        value = 1;

        constructor() {
            super();

            this.value = 2;
        }
    }

    class ServiceB extends Service {
        a: ServiceA;

        constructor() {
            super();

            this.a = this.require(ServiceA);
        }
    }

    class ServiceX extends Service {
        y: ServiceY;

        constructor() {
            super();

            this.y = this.require(ServiceY);
        }
    }

    class ServiceY extends Service {
        x: ServiceX;

        constructor() {
            super();

            this.x = this.require(ServiceX);
        }
    }

    it("hashes arguments correctly", () => {
        const args = {
            a: [{ a: 1, b: 2, service: serviceA }],
            b: [{ b: 2, a: 1, service: serviceB }],
            c: [{ b: 2, a: 1, service: serviceA }],
            d: [{ b: 2, a: 1, service: serviceB }],
            e: [2],
            f: ["2"],
            g: [true],
            h: [null, true],
            i: [null, undefined, serviceA],
            j: [null, null, serviceA],
        };

        const hashes = {
            a: serviceIdentifier(args.a),
            b: serviceIdentifier(args.b),
            c: serviceIdentifier(args.c),
            d: serviceIdentifier(args.d),
            e: serviceIdentifier(args.e),
            f: serviceIdentifier(args.f),
            g: serviceIdentifier(args.g),
            h: serviceIdentifier(args.h),
            i: serviceIdentifier(args.i),
            j: serviceIdentifier(args.j),
        };

        expect(hashes.a).not.toBe(hashes.b);
        expect(hashes.a).toBe(hashes.c);
        expect(hashes.b).toBe(hashes.d);
        expect(hashes.e).not.toBe(hashes.f);
        expect(hashes.g).not.toBe(hashes.h);
        expect(hashes.i).toBe(hashes.j);

        const service = serviceA || servido.require({ service: ServiceA, dependent, context });

        const serviceIdentifier1 = serviceIdentifier([service]);
        service.value = 10;
        const serviceIdentifier2 = serviceIdentifier([service]);

        expect(serviceIdentifier1).toEqual(serviceIdentifier2);

        const typeIdentifierA = serviceIdentifier([ServiceA]);
        (ServiceA as any).X = 2;
        const typeIdentifierA2 = serviceIdentifier([ServiceA]);
        const typeIdentifierB = serviceIdentifier([ServiceB]);
        expect(typeIdentifierA).not.toEqual(typeIdentifierB);
        expect(typeIdentifierA).toEqual(typeIdentifierA2);

        const typeIdentifierAB = serviceIdentifier([ServiceA, ServiceB]);
        (ServiceA as any).X = 3;
        const typeIdentifierAB2 = serviceIdentifier([ServiceA, ServiceB]);
        const typeIdentifierBA = serviceIdentifier([ServiceB, ServiceA]);

        expect(typeIdentifierAB).not.toEqual(typeIdentifierBA);
        expect(typeIdentifierAB).toEqual(typeIdentifierAB2);
    });
});
