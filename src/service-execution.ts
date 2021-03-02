import { useClearedMemo } from "use-cleared-memo";

/** There are a lot of asynchronity related to services, and the ServiceExecution class is intended to make that clearer.
 * A service execution exists in the root of every constructed service, which is set done as soon as the service has deconstructed.
 *
 * A child-execution is passed to the `asyncConstructor` method, which is set done when the method resolves or when the service has been deconstructed.
 * A child-execution is also passed to the `getData`, `handleData`, and `handleDataError` config methods, which is set done as soon as the data has been retrieved and handled,
 * hydration of the data has been requested, or when the service has been deconstructed.
 *
 * Now, when developing a service, the execution of the service can be very useful for other purposes. Child-executions can be created for all sorts of asynchronous
 * and cancelable purposes. For instance, a form service may use a child-execution for its submission process, allowing the submission to be canceled mid-way, during validation or so,
 * or if the service is deconstructed.
 */
export class ServiceExecution {
    private _done?: boolean;
    private _doneListeners?: Set<ExecutionDoneListener>;
    private key = String(keyIndex++);

    /** Returns a child execution context that will be done whenever its parent is done, or when it is done itself. Its state does not affect the state of its parent. */
    nest() {
        return ServiceExecution.nest(this, new ServiceExecution());
    }

    setDone() {
        if (this._done) {
            return;
        }
        this._done = true;
        if (!this._doneListeners) {
            return;
        }
        this._doneListeners.forEach((listener) => listener());
        this._doneListeners.clear();
    }

    /** Listen to whenever the execution is done. Returns a function to stop listening. */
    onDone(listener: ExecutionDoneListener): ExecutionDoneUnsubscriber {
        if (typeof listener !== "function") {
            return function noop() {
                return false;
            };
        } else if (this.done) {
            if (this.done) {
                listener();
            }
            return function noop() {
                return false;
            };
        }

        if (!this._doneListeners) {
            this._doneListeners = new Set();
        }
        this._doneListeners.add(listener);
        return () => {
            if (!this._doneListeners) {
                return false;
            }
            return this._doneListeners.delete(listener);
        };
    }

    /** Run actions for the execution. If any of the actions returns `void` or if the execution is done, the next action will not be run.
     * Every action inherits the value returned from the previous action (unless that value is `void`). */
    run<_1>(_1: () => _1 | Promise<_1>): Promise<void | _1>;
    run<_1, _2>(_1: () => _1 | void | Promise<_1 | void>, _2: (_1: _1) => _2 | void | Promise<_2 | void>): Promise<_2 | void>;
    run<_1, _2, _3>(
        _1: () => _1 | void | Promise<_1 | void>,
        _2: (_1: _1) => _2 | void | Promise<_2 | void>,
        _3: (_2: _2) => _3 | void | Promise<_3 | void>,
    ): Promise<_3 | void>;
    run<_1, _2, _3, _4>(
        _1: () => _1 | void | Promise<_1 | void>,
        _2: (_1: _1) => _2 | void | Promise<_2 | void>,
        _3: (_2: _2) => _3 | void | Promise<_3 | void>,
        _4: (_3: _3) => _4 | void | Promise<_4 | void>,
    ): Promise<_4 | void>;
    run<_1, _2, _3, _4, _5>(
        _1: () => _1 | void | Promise<_1 | void>,
        _2: (_1: _1) => _2 | void | Promise<_2 | void>,
        _3: (_2: _2) => _3 | void | Promise<_3 | void>,
        _4: (_3: _3) => _4 | void | Promise<_4 | void>,
        _5: (_4: _4) => _5 | void | Promise<_5 | void>,
    ): Promise<_5 | void>;
    async run<T>(...actions: any[]): Promise<void | T> {
        if (this.done) {
            return;
        }
        const value = await Promise.race<Promise<void> | Promise<void | T>>([
            this.promise,
            new Promise(async (resolve, reject) => {
                const index = 0;
                let value: any;
                while (!this.done && actions[index]) {
                    try {
                        value = await actions[index](value);
                        if (value === undefined) {
                            resolve();
                            return;
                        }
                    } catch (error) {
                        reject(error);
                        return;
                    }
                }
                resolve(value);
            }),
        ]);
        return value;
    }

    /** Resolves to whenever the execution is done. */
    get promise(): Promise<void> {
        if (this.done) {
            return Promise.resolve();
        }
        return new Promise((resolve) => this.onDone(resolve));
    }

    /** The current state of the execution. */
    get done() {
        return this._done === true;
    }

    protected toString() {
        return "ServiceExecution(" + this.key + ")";
    }

    static nest<ET extends ServiceExecution>(parent: ServiceExecution, child: ET = new ServiceExecution() as any) {
        const unsubscribeDone = parent.onDone(() => child.setDone());
        child.onDone(unsubscribeDone);
        if (parent.key) {
            child.key = parent.key + "-" + child.key;
        }
        return child;
    }

    static nestMany<ET extends ServiceExecution>(parents: ServiceExecution[], child: ET = new ServiceExecution() as any): ET {
        parents.forEach((parent) => this.nest(parent, child));
        return child;
    }
}

let keyIndex = 1;

interface ExecutionDoneListener {
    (): void;
}

interface ExecutionDoneUnsubscriber {
    (): boolean;
}

/** It is oftentime useful to declare a slot for a category of executions. For instance, a service might have
 * a method that uses an execution but that should only be processing once. It simply features that if there is a current
 * pending execution in the slot when a new execution is set, the previous execution is set done. It also provides the getter `promise`
 * which returns a promise that is resolved when the last execution is done. */
export class ServiceExecutionSlot {
    private _current: ServiceExecution | undefined;

    constructor() {}

    set(execution: ServiceExecution = new ServiceExecution()) {
        if (this._current !== execution) {
            this.setDone();
            this._current = execution;
        }
        return execution;
    }

    setDone() {
        if (this._current) {
            this._current.setDone();
            this._current = undefined;
        }
    }

    get current() {
        return this._current;
    }

    get done() {
        return this._current ? this._current.done : true;
    }

    get promise(): Promise<void> {
        return Promise.resolve().then(() => {
            if (!this.done) {
                return this.current.promise.then(() => this.promise);
            }
        });
    }

    /** Returns a service execution slot to be used inside a component. If deps change, a new execution slot will be constructed and the previous one will be set to done.
     * Additionally, the current execution is set to done on unmount. */
    static use(deps: readonly any[] = []) {
        return useClearedMemo(
            () => new ServiceExecutionSlot(),
            (previous) => previous.setDone(),
            deps,
        );
    }
}

export class ServiceDataExecution extends ServiceExecution {
    nest() {
        return ServiceExecution.nest(this, new ServiceDataExecution());
    }

    static from(parent: ServiceExecution) {
        if (parent instanceof ServiceDataExecution) {
            return parent.nest();
        }
        return ServiceExecution.nest(parent, new ServiceDataExecution());
    }

    static fromMany(parents: ServiceExecution[]) {
        return ServiceExecution.nestMany(parents, new ServiceDataExecution());
    }
}
