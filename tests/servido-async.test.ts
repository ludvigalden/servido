import { ServidoAsync, requireServido, forgoServido, ServidoContext, Servido } from "../src";

describe("servido async", () => {
    const dependent = 0;
    const context = ServidoContext.get();

    let servidoK: ServidoK;

    it("constructs", () => {
        servidoK = requireServido({ servido: ServidoK, dependent, context });

        expect(servidoK.constructing.current).toEqual(true);
        expect(servidoK.value).toEqual(2);

        expect(servidoK.constructing.onDone(() => servidoK.value)).resolves.toEqual(3);
    });

    let servidoL: ServidoL;

    it("constructs link", () => {
        servidoL = requireServido({ servido: ServidoL, dependent, context });
        servidoK = requireServido({ servido: ServidoK, dependent, context });

        expect(servidoK.constructing.current).toEqual(true);
        expect(servidoL.value).toEqual(2);
        expect(context.requirements.get(servidoL)).toContain(servidoK);
        expect(context.requirements.get(servidoK)).toBeUndefined();
        expect(context.dependents.get(servidoK)).toContain(servidoL);
        expect(context.dependents.get(servidoK)).toContain(dependent);
        expect(context.dependents.get(servidoL)).toContain(dependent);

        expect(servidoL.k.constructing.onDone(() => servidoL.value)).resolves.toEqual(3);
        expect(
            new Promise((resolve) => {
                servidoL.constructing.onDone(() => {
                    resolve(servidoL.value);
                });
            }),
        ).resolves.toEqual(4);
    });

    it("deconstructs link", () => {
        forgoServido({ servido: servidoL, dependent, context });

        expect(context.requirements.get(servidoL)).toBeUndefined();
        expect(context.dependents.get(servidoL)).toBeUndefined();
        expect(context.requirements.get(dependent)).not.toContain(servidoL);
        expect(context.requirements.get(dependent)).toContain(servidoK);

        forgoServido({ servido: servidoK, dependent, context });

        expect(context.requirements.get(servidoK)).toBeUndefined();
        expect(context.requirements.get(dependent)).toBeUndefined();
        expect(context.dependents.get(servidoK)).toBeUndefined();
    });

    let servidoN: ServidoN;
    let servidoM: ServidoM;

    it("constructs circular link", () => {
        servidoM = requireServido({ servido: ServidoM, dependent, context });

        expect(context.requirements.get(dependent)).toContain(servidoM);
        expect(context.dependents.get(servidoM)).toContain(dependent);

        expect(servidoM.n).toBeDefined();
        expect(context.requirements.get(servidoM)).toContain(servidoM.n);
        expect(context.dependents.get(servidoM)).toContain(servidoM.n);
        expect(context.requirements.get(servidoM.n)).toContain(servidoM);
        expect(context.dependents.get(servidoM.n)).toContain(servidoM);
        expect(context.requirements.get(dependent)).not.toContain(servidoM.n);
        expect(context.dependents.get(servidoM.n)).not.toContain(dependent);

        servidoN = requireServido({ servido: ServidoN, dependent, context });

        expect(servidoN.m).toBeDefined();
        expect(servidoN).toEqual(servidoM.n);
        expect(servidoM).toEqual(servidoN.m);

        expect(context.requirements.get(dependent)).toContain(servidoN);
        expect(context.requirements.get(servidoN)).toContain(servidoM);
        expect(context.dependents.get(servidoN)).toContain(servidoM);
        expect(context.dependents.get(servidoN)).toContain(dependent);

        expect(context.circularRequirements.get(servidoN)).toContain(servidoM);
        expect(context.circularRequirements.get(servidoM)).toContain(servidoN);

        expect(servidoM.constructing.onDone(() => servidoM.n)).resolves.toEqual(servidoN);
        expect(servidoN.constructing.onDone(() => servidoN.m)).resolves.toEqual(servidoM);
    });

    it("deconstructs circular link", () => {
        servidoM = requireServido({ servido: ServidoM, dependent, context });
        servidoN = requireServido({ servido: ServidoN, dependent, context });

        forgoServido({ servido: servidoN, dependent, context });

        expect(context.dependents.get(servidoN)).not.toContain(dependent);
        expect(context.requirements.get(dependent)).not.toContain(servidoN);

        expect(context.requirements.get(servidoM)).toContain(servidoN);
        expect(context.dependents.get(servidoM)).toContain(servidoN);
        expect(context.requirements.get(servidoN)).toContain(servidoM);
        expect(context.dependents.get(servidoN)).toContain(servidoM);

        forgoServido({ servido: servidoM, dependent, context });

        expect(context.circularRequirements.size).toEqual(0);
        expect(context.constructed.size).toEqual(0);
        expect(context.constructedAsync.size).toEqual(0);
        expect(context.constructors.size).toEqual(0);
        expect(context.dependents.size).toEqual(0);
        expect(context.requirements.size).toEqual(0);
    });

    let servidoQ: ServidoQ;

    it("deconstructs deep ciricular links", () => {
        servidoQ = requireServido({ servido: ServidoQ, dependent, context });

        expect(servidoQ.o).toBeDefined();
        expect(servidoQ.o.m).toBeDefined();
        expect(servidoQ.o.m.n).toBeDefined();
        expect(servidoQ.o.m.n.m).toBeDefined();
        expect(servidoQ.p).toBeDefined();
        expect(servidoQ.p.q).toEqual(servidoQ);
        expect(servidoQ.p.o).toEqual(servidoQ.o);

        forgoServido({ servido: servidoQ, dependent, context });

        expect(context.circularRequirements.size).toEqual(0);
        expect(context.constructed.size).toEqual(0);
        expect(context.constructedAsync.size).toEqual(0);
        expect(context.constructors.size).toEqual(0);
        expect(context.dependents.size).toEqual(0);
        expect(context.requirements.size).toEqual(0);
    });
});

class ServidoK extends ServidoAsync {
    value = 1;

    async constructorAsync() {
        this.value = 2;

        await new Promise((resolve) => setTimeout(resolve, 500));

        this.value = 3;
    }
}

class ServidoL extends ServidoAsync {
    k: ServidoK;

    value = 1;

    constructor() {
        super();

        this.k = this.require(ServidoK);
    }

    async constructorAsync() {
        this.value = 2;

        await this.k.constructing.onDone();

        this.value = 3;

        await new Promise((resolve) => setTimeout(resolve, 500));

        this.value = 4;
    }
}

class ServidoM extends ServidoAsync {
    n: ServidoN;

    async constructorAsync() {
        this.n = this.require(ServidoN);
    }
}

class ServidoN extends ServidoAsync {
    m: ServidoM;

    async constructorAsync() {
        this.m = this.require(ServidoM);
    }
}

class ServidoO extends Servido {
    m: ServidoM;
    n: ServidoN;

    constructor() {
        super();

        this.m = this.require(ServidoM);
        this.n = this.require(ServidoN);
    }
}

class ServidoP extends ServidoAsync {
    o: ServidoO;
    q: ServidoQ;

    constructor() {
        super();

        this.o = this.require(ServidoO);
    }

    async constructorAsync() {
        this.q = this.require(ServidoQ);
    }
}

class ServidoQ extends ServidoAsync {
    p: ServidoP;
    o: ServidoO;

    constructor() {
        super();

        this.o = this.require(ServidoO);
    }

    constructorAsync() {
        this.p = this.require(ServidoP);
    }
}
