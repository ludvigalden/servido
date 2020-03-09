import Servido from "../src";

describe("service async", () => {
    const dependent = 0;
    const context = Servido.Context.get();

    let serviceK: ServiceK;

    it("constructs", () => {
        serviceK = Servido.require({ service: ServiceK, dependent, context });

        expect(Servido.constructing(serviceK)).toEqual(true);
        expect(serviceK.value).toEqual(2);

        expect(Servido.resolve(serviceK).then(() => serviceK.value)).resolves.toEqual(3);
    });

    let serviceL: ServiceL;

    it("constructs link", () => {
        serviceL = Servido.require({ service: ServiceL, dependent, context });
        serviceK = Servido.require({ service: ServiceK, dependent, context });

        expect(Servido.constructing(serviceK)).toEqual(true);
        expect(serviceL.value).toEqual(2);
        expect(context.requirements.get(serviceL)).toContain(serviceK);
        expect(context.requirements.get(serviceK)).toBeUndefined();
        expect(context.dependents.get(serviceK)).toContain(serviceL);
        expect(context.dependents.get(serviceK)).toContain(dependent);
        expect(context.dependents.get(serviceL)).toContain(dependent);

        expect(Servido.resolve(serviceL.k).then(() => serviceL.value)).resolves.toEqual(3);
        expect(Servido.resolve(serviceL).then(() => serviceL.value)).resolves.toEqual(4);
    });

    it("deconstructs link", () => {
        Servido.forgo({ service: serviceL, dependent, context });

        expect(context.requirements.get(serviceL)).toBeUndefined();
        expect(context.dependents.get(serviceL)).toBeUndefined();
        expect(context.requirements.get(dependent)).not.toContain(serviceL);
        expect(context.requirements.get(dependent)).toContain(serviceK);

        Servido.forgo({ service: serviceK, dependent, context });

        expect(context.requirements.get(serviceK)).toBeUndefined();
        expect(context.requirements.get(dependent)).toBeUndefined();
        expect(context.dependents.get(serviceK)).toBeUndefined();
    });

    let serviceN: ServiceN;
    let serviceM: ServiceM;

    it("constructs circular link", () => {
        serviceM = Servido.require({ service: ServiceM, dependent, context });

        expect(context.requirements.get(dependent)).toContain(serviceM);
        expect(context.dependents.get(serviceM)).toContain(dependent);

        expect(serviceM.n).toBeDefined();
        expect(context.requirements.get(serviceM)).toContain(serviceM.n);
        expect(context.dependents.get(serviceM)).toContain(serviceM.n);
        expect(context.requirements.get(serviceM.n)).toContain(serviceM);
        expect(context.dependents.get(serviceM.n)).toContain(serviceM);
        expect(context.requirements.get(dependent)).not.toContain(serviceM.n);
        expect(context.dependents.get(serviceM.n)).not.toContain(dependent);

        serviceN = Servido.require({ service: ServiceN, dependent, context });

        expect(serviceN.m).toBeDefined();
        expect(serviceN).toEqual(serviceM.n);
        expect(serviceM).toEqual(serviceN.m);

        expect(context.requirements.get(dependent)).toContain(serviceN);
        expect(context.requirements.get(serviceN)).toContain(serviceM);
        expect(context.dependents.get(serviceN)).toContain(serviceM);
        expect(context.dependents.get(serviceN)).toContain(dependent);

        expect(context.circularRequirements.get(serviceN)).toContain(serviceM);
        expect(context.circularRequirements.get(serviceM)).toContain(serviceN);

        expect(Servido.resolve(serviceM).then(() => serviceM.n)).resolves.toEqual(serviceN);
        expect(Servido.resolve(serviceN).then(() => serviceN.m)).resolves.toEqual(serviceM);
    });

    it("deconstructs circular link", () => {
        serviceM = Servido.require({ service: ServiceM, dependent, context });
        serviceN = Servido.require({ service: ServiceN, dependent, context });

        Servido.forgo({ service: serviceN, dependent, context });

        expect(context.dependents.get(serviceN)).not.toContain(dependent);
        expect(context.requirements.get(dependent)).not.toContain(serviceN);

        expect(context.requirements.get(serviceM)).toContain(serviceN);
        expect(context.dependents.get(serviceM)).toContain(serviceN);
        expect(context.requirements.get(serviceN)).toContain(serviceM);
        expect(context.dependents.get(serviceN)).toContain(serviceM);

        Servido.forgo({ service: serviceM, dependent, context });

        expect(context.circularRequirements.size).toEqual(0);
        expect(context.constructed.size).toEqual(0);
        expect(context.constructedAsync.size).toEqual(0);
        expect(context.constructors.size).toEqual(0);
        expect(context.dependents.size).toEqual(0);
        expect(context.requirements.size).toEqual(0);
    });

    let serviceQ: ServiceQ;

    it("deconstructs deep ciricular links", () => {
        serviceQ = Servido.require({ service: ServiceQ, dependent, context });

        expect(serviceQ.o).toBeDefined();
        expect(serviceQ.o.m).toBeDefined();
        expect(serviceQ.o.m.n).toBeDefined();
        expect(serviceQ.o.m.n.m).toBeDefined();
        expect(serviceQ.p).toBeDefined();
        expect(serviceQ.p.q).toEqual(serviceQ);
        expect(serviceQ.p.o).toEqual(serviceQ.o);

        Servido.forgo({ service: serviceQ, dependent, context });

        expect(context.circularRequirements.size).toEqual(0);
        expect(context.constructed.size).toEqual(0);
        expect(context.constructedAsync.size).toEqual(0);
        expect(context.constructors.size).toEqual(0);
        expect(context.dependents.size).toEqual(0);
        expect(context.requirements.size).toEqual(0);
    });
});

class ServiceK extends Servido.Async {
    value = 1;

    async constructorAsync() {
        this.value = 2;

        await new Promise((resolve) => setTimeout(resolve, 500));

        this.value = 3;
    }
}

class ServiceL extends Servido.Async {
    k: ServiceK;

    value = 1;

    constructor() {
        super();

        this.k = this.require(ServiceK);
    }

    async constructorAsync() {
        this.value = 2;

        await Servido.resolve(this.k);

        this.value = 3;

        await new Promise((resolve) => setTimeout(resolve, 500));

        this.value = 4;
    }
}

class ServiceM extends Servido.Async {
    n: ServiceN;

    async constructorAsync() {
        this.n = this.require(ServiceN);
    }
}

class ServiceN extends Servido.Async {
    m: ServiceM;

    async constructorAsync() {
        this.m = this.require(ServiceM);
    }
}

class ServiceO extends Servido {
    m: ServiceM;
    n: ServiceN;

    constructor() {
        super();

        this.m = this.require(ServiceM);
        this.n = this.require(ServiceN);
    }
}

class ServiceP extends Servido.Async {
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

class ServiceQ extends Servido.Async {
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
