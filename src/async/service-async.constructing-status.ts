import React from "react";

export class ServiceConstructingStatus {
    static ID_INDEX = 0;

    private $ids = new Set<any>();
    private $notify = new Set<(constructing: boolean) => any>();

    current = true;

    constructor() {
        Object.defineProperty(this, "$ids", { configurable: false, writable: false, enumerable: false });
        Object.defineProperty(this, "$notify", { configurable: false, writable: false, enumerable: false });
    }

    start(id: any = String(ServiceConstructingStatus.ID_INDEX++)) {
        this.$ids.add(id);

        this.set(true);

        return () => this.stop(id);
    }

    stop(id: any) {
        this.$ids.delete(id);

        if (!this.$ids.size) {
            this.set(false);
        }
    }

    onDone<T = void>(callback?: () => Promise<T> | T) {
        return new Promise<T>((resolve) => {
            if (!this.current) {
                return resolve(callback ? callback() : undefined);
            }

            const subscription = (constructing: boolean) => {
                if (!constructing) {
                    this.$notify.delete(subscription);
                    return resolve(callback ? callback() : undefined);
                }
            };

            this.$notify.add(subscription);
        });
    }

    use() {
        const [constructing, setConstructing] = React.useState(() => this.current);

        React.useMemo(() => this.$notify.add(setConstructing), [setConstructing]);
        React.useEffect(
            () => () => {
                this.$notify.delete(setConstructing);
            },
            [setConstructing],
        );

        return constructing;
    }

    protected set(constructing: boolean) {
        if (this.current !== constructing) {
            this.current = constructing;
            [...this.$notify].forEach((callback) => typeof callback === "function" && callback(this.current));
        }
    }
}
