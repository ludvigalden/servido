import servido, { Service, ServiceContext, ServiceDependent } from "../src";
import { isServiceClass } from "../src/service-fns";

describe("service", () => {
    const context = servido.Context.get();
    const dependent = new ServiceDependent("test", context);

    let serviceA: ServiceA;

    it("constructs", () => {
        serviceA = servido.require({ service: ServiceA, dependent });
        expect(serviceA.value).toEqual(2);
    });

    it("constructs new with different context", () => {
        const newServiceA = servido.require({ service: ServiceA, dependent: new ServiceDependent("test2", new ServiceContext()) });
        expect(newServiceA === serviceA).toEqual(false);
    });

    it("checks is-class correctly", () => {
        expect(isServiceClass(ServiceA)).toEqual(true);
        expect(isServiceClass(serviceA)).toEqual(false);
    });

    class ServiceA extends Service {
        value = 1;

        constructor() {
            super();

            this.value = 2;
        }
    }
});
