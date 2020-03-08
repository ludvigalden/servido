import React from "react";

export class ConstructingStatus {
    static ID_INDEX = 0;

    private _$ids = new Set<any>();
    private _$notify = new Set<(constructing: boolean) => any>();

    current = true;

    constructor() {
        Object.defineProperty(this, "_$ids", { configurable: false, writable: false, enumerable: false });
        Object.defineProperty(this, "_$notify", { configurable: false, writable: false, enumerable: false });
    }

    start(id: any = String(ConstructingStatus.ID_INDEX++)) {
        this._$ids.add(id);

        if (!this.current) {
            this.current = true;
            [...this._$notify].forEach((callback) => callback(this.current));
        }

        return () => this.stop(id);
    }

    stop(id: any) {
        this._$ids.delete(id);

        if (!this._$ids.size && this.current) {
            this.current = false;
            [...this._$notify].forEach((callback) => callback(this.current));
        }
    }

    onDone<T = void>(callback?: () => Promise<T> | T) {
        return new Promise<T>((resolve) => {
            if (!this.current) {
                return resolve(callback ? callback() : undefined);
            }

            const subscription = (constructing: boolean) => {
                if (!constructing) {
                    this._$notify.delete(subscription);
                    return resolve(callback ? callback() : undefined);
                }
            };

            this._$notify.add(subscription);
        });
    }

    use() {
        const [constructing, setConstructing] = React.useState(() => this.current);

        React.useMemo(() => this._$notify.add(setConstructing), [setConstructing]);
        React.useEffect(
            () => () => {
                this._$notify.delete(setConstructing);
            },
            [setConstructing],
        );

        return constructing;
    }
}
