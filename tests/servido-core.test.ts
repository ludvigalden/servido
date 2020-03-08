import { Service, requireService, ServiceContext, forgoService } from "../src";
import { getClassThunkConstructor, isClass, serviceIdentifier, CircularDependencyError } from "../src/core";

describe("service core", () => {
    const dependent = 0;
    const context = ServiceContext.get();

    let serviceA: ServiceA;

    it("constructs", () => {
        serviceA = requireService({ service: ServiceA, dependent, context });
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
            const identifier = serviceIdentifier(undefined);
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
        const newServiceA = requireService({ service: ServiceA, dependent, context: new ServiceContext() });
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
        serviceB = requireService({ service: ServiceB, dependent, context });
        expect(getClassThunkConstructor(serviceB.a)).toEqual(ServiceA);
        expect(serviceB.a).toEqual(serviceA);
        expect(context.requirements.get(serviceB)).toContain(serviceA);
        expect(context.requirements.get(dependent)).toContain(serviceB);
    });

    it("throws and clears on circular sync requirements", () => {
        let error: Error | undefined;

        try {
            requireService({ service: ServiceY, dependent, context });
        } catch (_error) {
            error = _error;
        }

        expect(error).toBeDefined();
        expect(error instanceof CircularDependencyError).toBe(true);
        expect(context.constructed.get(ServiceX)).toBeUndefined();
        expect(context.constructed.get(ServiceY)).toBeUndefined();
    });

    it("deconstructs", () => {
        serviceA = requireService({ service: ServiceA, dependent, context });
        serviceB = requireService({ service: ServiceB, dependent, context });

        expect(context.requirements.get(serviceB)).toContain(serviceA);
        expect(context.dependents.get(serviceA)).toContain(serviceB);

        forgoService({ service: serviceB, dependent, context });

        expect(context.constructed.get(ServiceB)).toBeUndefined();
        expect(context.requirements.get(serviceB)).toBeUndefined();
        expect(context.dependents.get(serviceA)).not.toContain(serviceB);
        expect(context.constructors.get(serviceB)).toBeUndefined();

        expect(context.requirements.get(dependent)).not.toContain(serviceB);

        expect(context.dependents.get(serviceA)).toContain(dependent);

        forgoService({ service: serviceA, dependent, context });

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
});
