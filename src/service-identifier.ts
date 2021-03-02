import atob from "atob";

function N(r: number[], a: string, enc: InputEncoding) {
    if (Array.isArray(a)) {
        const n = a.length;
        for (let i = 0; i < n; i++) {
            r.push(a[i]);
        }
    } else {
        if (enc === "utf8") {
            const b = unescape(encodeURIComponent(a));
            const n = b.length;
            for (let i = 0; i < n; i++) {
                r.push(b.charCodeAt(i));
            }
        } else {
            const n = a.length;
            for (let i = 0; i < n; i++) {
                const c = a.charCodeAt(i) & 0xff;
                r.push(c === 0 && enc === "ascii" ? 0x20 : c);
            }
        }
    }
}

const O = function (a: number[], c: OutputEncoding) {
    let r = null;
    const s = function (e: any) {
        return String.fromCharCode(e);
    };
    const h = function (e: any) {
        return e.toString(16);
    };
    switch (c) {
        case "binary":
            r = a.map(s).join("");
            break;
        case "base64":
            r = atob(a.map(s).join(""));
            break;
        default:
            r = a.map(h).join("");
            break;
    }
    return r;
};

const R = function (n: number, s: number) {
    return (n << s) | (n >>> (32 - s));
};

function SHA1(w: number[]) {
    const M = 0x0ffffffff;
    const W = new Array(80);
    const H = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];

    for (let b = 0; b < w.length; b += 16) {
        let A = H[0],
            B = H[1],
            C = H[2],
            D = H[3],
            E = H[4];

        for (let i = 0; i < 16; i++) {
            W[i] = w[b + i];
        }

        for (let i = 16; i <= 79; i++) {
            W[i] = R(W[i - 3] ^ W[i - 8] ^ W[i - 14] ^ W[i - 16], 1);
        }

        for (let i = 0; i <= 19; i++) {
            const t = (R(A, 5) + ((B & C) | (~B & D)) + E + W[i] + 0x5a827999) & M;
            E = D;
            D = C;
            C = R(B, 30);
            B = A;
            A = t;
        }

        for (let i = 20; i <= 39; i++) {
            const t = (R(A, 5) + (B ^ C ^ D) + E + W[i] + 0x6ed9eba1) & M;
            E = D;
            D = C;
            C = R(B, 30);
            B = A;
            A = t;
        }

        for (let i = 40; i <= 59; i++) {
            const t = (R(A, 5) + ((B & C) | (B & D) | (C & D)) + E + W[i] + 0x8f1bbcdc) & M;
            E = D;
            D = C;
            C = R(B, 30);
            B = A;
            A = t;
        }

        for (let i = 60; i <= 79; i++) {
            const t = (R(A, 5) + (B ^ C ^ D) + E + W[i] + 0xca62c1d6) & M;
            E = D;
            D = C;
            C = R(B, 30);
            B = A;
            A = t;
        }

        H[0] = (H[0] + A) & M;
        H[1] = (H[1] + B) & M;
        H[2] = (H[2] + C) & M;
        H[3] = (H[3] + D) & M;
        H[4] = (H[4] + E) & M;
    }

    return H;
}

function createHashSHA1() {
    const c: number[] = [];
    const r: number[] = [];
    return {
        update: function (a: string, e: InputEncoding) {
            N(c, a, e);
        },
        digest: function (outputEncoding: OutputEncoding) {
            const n = c.length;
            for (let i = 0; i < n - 3; i += 4) {
                r.push((c[i] << 24) | (c[i + 1] << 16) | (c[i + 2] << 8) | c[i + 3]);
            }

            switch (n % 4) {
                case 0:
                    r.push(0x080000000);
                    break;
                case 1:
                    r.push((c[n - 1] << 24) | 0x0800000);
                    break;
                case 2:
                    r.push((c[n - 2] << 24) | (c[n - 1] << 16) | 0x08000);
                    break;
                case 3:
                    r.push((c[n - 3] << 24) | (c[n - 2] << 16) | (c[n - 1] << 8) | 0x80);
                    break;
            }
            while (r.length % 16 != 14) {
                r.push(0);
            }
            r.push(n >>> 29);
            r.push((n << 3) & 0x0ffffffff);

            return O(
                SHA1(r).reduce(function (r: number[], a: number) {
                    for (let i = 7; i >= 0; --i) {
                        r.push((a >>> (i * 4)) & 0x0f);
                    }
                    return r;
                }, []),
                outputEncoding,
            );
        },
    };
}

const IC = [String, Number, Map, Set, Object];

export function hash(
    a: any,
    {
        inputEncoding = "utf8",
        outputEncoding = "hex",
        sets,
    }: { inputEncoding?: InputEncoding; outputEncoding?: OutputEncoding; sets?: boolean } = {},
) {
    const h = createHashSHA1();
    const u = (...args: string[]) => h.update(args.join(":"), inputEncoding);
    const d = (a: string) => hash(a, { inputEncoding, outputEncoding, sets });

    switch (true) {
        // null or undefined
        case a == null:
            u("n");
            break;

        // boolean
        case typeof a === "boolean":
        case a instanceof Boolean:
            u("f", a.valueOf());
            break;

        // number
        case typeof a === "number":
        case a instanceof Number:
            u("i", `${a}`);
            break;

        // string
        case typeof a === "string":
        case a instanceof String:
            u("s", `${a}`);
            break;

        // symbol
        case typeof a === "symbol":
        case a instanceof Symbol:
            u("S", `${a}`);
            break;

        // date
        case a instanceof Date:
            u("d", a.toISOString());
            break;

        // regexp
        case a instanceof RegExp:
            u("x", `${a}`);
            break;

        // function
        case a instanceof Function:
            u("F", a.toString());
            break;

        // array
        case Array.isArray(a):
            if (sets) {
                u("<");
                a.map(d)
                    .sort()
                    .forEach((e: any) => u("A", e));
                u(">");
            } else {
                u("[");
                a.forEach((e: any) => u("a", d(e)));
                u("]");
            }
            break;

        // class instance
        case !IC.some((constructor) => a.constructor === constructor):
            u("I", a.constructor.toString());
            break;

        // object
        default:
            u("{");
            Object.keys(a)
                .sort()
                .forEach((k) => u("k", d(k), "v", d(a[k])));
            u("}");
            break;
    }
    return h.digest(outputEncoding);
}

type InputEncoding = "utf8" | "ascii";
type OutputEncoding = "hex" | "binary" | "base64";
