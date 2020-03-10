import servido, { Service, ServiceAsync } from "../src";

describe("service async", () => {
    const dependent = 0;
    const context = servido.Context.get();

    let serviceK: ServiceK;

    it("constructs", () => {
        serviceK = servido.require({ service: ServiceK, dependent, context });

        expect(servido.constructing(serviceK)).toEqual(true);
        expect(serviceK.value).toEqual(2);

        expect(servido.resolve(serviceK).then(() => serviceK.value)).resolves.toEqual(3);
    });

    let serviceL: ServiceL;

    it("constructs link", () => {
        serviceL = servido.require({ service: ServiceL, dependent, context });
        serviceK = servido.require({ service: ServiceK, dependent, context });

        expect(servido.constructing(serviceK)).toEqual(true);
        expect(serviceL.value).toEqual(2);
        expect(context.requirements.get(serviceL)).toContain(serviceK);
        expect(context.requirements.get(serviceK)).toBeUndefined();
        expect(context.dependents.get(serviceK)).toContain(serviceL);
        expect(context.dependents.get(serviceK)).toContain(dependent);
        expect(context.dependents.get(serviceL)).toContain(dependent);

        expect(servido.resolve(serviceL.k).then(() => serviceL.value)).resolves.toEqual(3);
        expect(servido.resolve(serviceL).then(() => serviceL.value)).resolves.toEqual(4);
    });

    it("deconstructs link", () => {
        servido.forgo({ service: serviceL, dependent, context });

        expect(context.requirements.get(serviceL)).toBeUndefined();
        expect(context.dependents.get(serviceL)).toBeUndefined();
        expect(context.requirements.get(dependent)).not.toContain(serviceL);
        expect(context.requirements.get(dependent)).toContain(serviceK);

        servido.forgo({ service: serviceK, dependent, context });

        expect(context.requirements.get(serviceK)).toBeUndefined();
        expect(context.requirements.get(dependent)).toBeUndefined();
        expect(context.dependents.get(serviceK)).toBeUndefined();
    });

    let serviceN: ServiceN;
    let serviceM: ServiceM;

    it("constructs circular link", () => {
        serviceM = servido.require({ service: ServiceM, dependent, context });

        expect(context.requirements.get(dependent)).toContain(serviceM);
        expect(context.dependents.get(serviceM)).toContain(dependent);

        expect(serviceM.n).toBeDefined();
        expect(context.requirements.get(serviceM)).toContain(serviceM.n);
        expect(context.dependents.get(serviceM)).toContain(serviceM.n);
        expect(context.requirements.get(serviceM.n)).toContain(serviceM);
        expect(context.dependents.get(serviceM.n)).toContain(serviceM);
        expect(context.requirements.get(dependent)).not.toContain(serviceM.n);
        expect(context.dependents.get(serviceM.n)).not.toContain(dependent);

        serviceN = servido.require({ service: ServiceN, dependent, context });

        expect(serviceN.m).toBeDefined();
        expect(serviceN).toEqual(serviceM.n);
        expect(serviceM).toEqual(serviceN.m);

        expect(context.requirements.get(dependent)).toContain(serviceN);
        expect(context.requirements.get(serviceN)).toContain(serviceM);
        expect(context.dependents.get(serviceN)).toContain(serviceM);
        expect(context.dependents.get(serviceN)).toContain(dependent);

        expect(context.circularRequirements.get(serviceN)).toContain(serviceM);
        expect(context.circularRequirements.get(serviceM)).toContain(serviceN);

        expect(servido.resolve(serviceM).then(() => serviceM.n)).resolves.toEqual(serviceN);
        expect(servido.resolve(serviceN).then(() => serviceN.m)).resolves.toEqual(serviceM);
    });

    it("deconstructs circular link", () => {
        serviceM = servido.require({ service: ServiceM, dependent, context });
        serviceN = servido.require({ service: ServiceN, dependent, context });

        servido.forgo({ service: serviceN, dependent, context });

        expect(context.dependents.get(serviceN)).not.toContain(dependent);
        expect(context.requirements.get(dependent)).not.toContain(serviceN);

        expect(context.requirements.get(serviceM)).toContain(serviceN);
        expect(context.dependents.get(serviceM)).toContain(serviceN);
        expect(context.requirements.get(serviceN)).toContain(serviceM);
        expect(context.dependents.get(serviceN)).toContain(serviceM);

        servido.forgo({ service: serviceM, dependent, context });

        expect(context.circularRequirements.size).toEqual(0);
        expect(context.constructed.size).toEqual(0);
        expect(context.constructedAsync.size).toEqual(0);
        expect(context.constructors.size).toEqual(0);
        expect(context.dependents.size).toEqual(0);
        expect(context.requirements.size).toEqual(0);
    });

    let serviceQ: ServiceQ;

    it("deconstructs deep ciricular links", () => {
        serviceQ = servido.require({ service: ServiceQ, dependent, context });

        expect(serviceQ.o).toBeDefined();
        expect(serviceQ.o.m).toBeDefined();
        expect(serviceQ.o.m.n).toBeDefined();
        expect(serviceQ.o.m.n.m).toBeDefined();
        expect(serviceQ.p).toBeDefined();
        expect(serviceQ.p.q).toEqual(serviceQ);
        expect(serviceQ.p.o).toEqual(serviceQ.o);

        servido.forgo({ service: serviceQ, dependent, context });

        expect(context.circularRequirements.size).toEqual(0);
        expect(context.constructed.size).toEqual(0);
        expect(context.constructedAsync.size).toEqual(0);
        expect(context.constructors.size).toEqual(0);
        expect(context.dependents.size).toEqual(0);
        expect(context.requirements.size).toEqual(0);
    });
});

class ServiceK extends ServiceAsync {
    value = 1;

    async constructorAsync() {
        this.value = 2;

        await new Promise((resolve) => setTimeout(resolve, 500));

        this.value = 3;
    }
}

class ServiceL extends ServiceAsync {
    k: ServiceK;

    value = 1;

    constructor() {
        super();

        this.k = this.require(ServiceK);
    }

    async constructorAsync() {
        this.value = 2;

        await servido.resolve(this.k);

        this.value = 3;

        await new Promise((resolve) => setTimeout(resolve, 500));

        this.value = 4;
    }
}

class ServiceM extends ServiceAsync {
    n: ServiceN;

    async constructorAsync() {
        this.n = this.require(ServiceN);
    }
}

class ServiceN extends ServiceAsync {
    m: ServiceM;

    async constructorAsync() {
        this.m = this.require(ServiceM);
    }
}

class ServiceO extends Service {
    m: ServiceM;
    n: ServiceN;

    constructor() {
        super();

        this.m = this.require(ServiceM);
        this.n = this.require(ServiceN);
    }
}

class ServiceP extends ServiceAsync {
    o: ServiceO;
    q: ServiceQ;

    constructor() {
        super();

        this.o = this.require(ServiceO);
    }

    async constructorAsync() {
        this.q = this.require(ServiceQ);
    }
}

class ServiceQ extends ServiceAsync {
    p: ServiceP;
    o: ServiceO;

    constructor() {
        super();

        this.o = this.require(ServiceO);
    }

    constructorAsync() {
        this.p = this.require(ServiceP);
    }
}
