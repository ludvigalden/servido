import { Service, ServiceConstructor } from "./service";
import { ServiceContext } from "./service-context";
import { hydrateData, parseDataConfig } from "./service-data-util";
import { ServiceDataExecution, ServiceExecution } from "./service-execution";
import { INTERNAL } from "./service-internal";
import { ServiceIdentifier } from "./service-types";
import { executionOf } from "./service-util";

export function constructService<S extends Service, A extends any[]>(props: ConstructServiceProps<S, A>): S;
export function constructService<S extends Service>(props: ConstructServiceProps<S, []>): S;
export function constructService(props: ConstructServiceProps<Service, any[]>) {
    const { constructor, context = ServiceContext.default, args } = props;
    const hasContext = context instanceof ServiceContext && context !== ServiceContext.default;

    if (hasContext) {
        // allow for requiring inside the constructor
        INTERNAL.defineProperty(constructor.prototype, "context", props.context, { configurable: true, enumerable: false });
    }

    let service: Service;

    if (args && args.length) {
        service = new constructor(...args);
    } else {
        service = new constructor();
    }

    if (props.id !== undefined) {
        INTERNAL.defineProperty(service, "identifier", props.id, { configurable: false, writable: false, enumerable: false });
    }

    if (hasContext) {
        // remove from prototype (shared) and add to instance
        // you might be considering the problem that a different service could be constructed in the constructor (see "new props.service(...)")
        // which could happen if the newly constructed service does not have a passed context (see "if (props.context != null"))
        // but according to design, the only way to construct a new service in a service constructor is to require it,
        // and in that case they will share the same context
        delete constructor.prototype[INTERNAL.property("context")];
        INTERNAL.defineProperty(service, "context", props.context, { configurable: false, writable: false, enumerable: false });
    }

    if (service["getServiceConfig"]) {
        INTERNAL.defineProperty(service, "config", service["getServiceConfig"](), {
            configurable: false,
            writable: false,
            enumerable: false,
        });
    }

    const { config, dataStore } = parseDataConfig(service);

    if (process.env.NODE_ENV === "development") {
        INTERNAL.defineProperty(service, "name", constructor.name, { configurable: false, writable: false, enumerable: false });

        if (config.getData && !constructor.key) {
            if (!missingKeys) {
                missingKeys = new Set();
            }
            if (!missingKeys.has(constructor.name)) {
                missingKeys.add(constructor.name);
                const currentSize = missingKeys.size;
                setTimeout(() => {
                    if (!missingKeys.size || missingKeys.size !== currentSize) {
                        return;
                    }
                    if (missingKeys.size > 1) {
                        const quoted = Array.from(missingKeys).map((key) => '"' + key + '"');
                        const formattedList =
                            quoted.length > 2
                                ? quoted.slice(0, quoted.length - 1).join(", ") + ", and " + quoted[quoted.length - 1]
                                : quoted.join(" and ");
                        console.warn(
                            formattedList +
                                " require data but do not have explicitly defined keys. This can lead to problems in production where classes may not have uniquely defined names." +
                                " Solve this by defining `static key = '...';` for the mentioned classes.",
                        );
                    } else {
                        console.warn(
                            '"' +
                                Array.from(missingKeys)[0] +
                                '" requires data but does not have an explicitly defined key. This can lead to problems in production where classes may not have uniquely defined names.' +
                                " Solve this by defining `static key = '...';` for the mentioned classes.",
                        );
                    }
                    missingKeys.clear();
                }, 500);
            }
        }
    } else if (constructor.key) {
        INTERNAL.defineProperty(service, "name", constructor.key, { configurable: false, writable: false, enumerable: false });
    }

    function setConstructionPromise() {
        const constructorPromises: PromiseLike<void>[] = [];
        let constructorExecution: ServiceExecution;
        INTERNAL.set(service, "constructing", true);
        INTERNAL.defineProperty(
            service,
            "promise",
            Promise.resolve()
                .then(() =>
                    Promise.all(constructorPromises).catch((error) =>
                        (props.context || ServiceContext.default).store.instance["notifyError"](error),
                    ),
                )
                .then(() => {
                    delete service[INTERNAL.property("constructing")];
                    if (constructorExecution) {
                        constructorExecution.setDone();
                    }
                })
                .then(() => {
                    const executionPromise = dataStore.getExecutionPromise(service);
                    if (executionPromise) {
                        return executionPromise;
                    }
                })
                .then(() => {
                    delete service[INTERNAL.property("promise")];
                }),
            { configurable: true, writable: true, enumerable: false },
        );
        if (service["asyncConstructor"]) {
            if (!constructorExecution) {
                constructorExecution = executionOf(service).nest();
            }
            constructorPromises.push(
                new Promise(async (resolve, reject) => {
                    await Promise.resolve();
                    if (constructed && constructed["then"]) {
                        constructed.catch((error) => {
                            error.message = "Failed constructing service " + (constructor.key || String(service)) + ". " + error.message;
                            reject(error);
                        });
                        constructed.then(resolve);
                    } else {
                        resolve(constructed);
                    }
                }),
            );
            let constructed: void | Promise<void>;
            try {
                constructed = service["asyncConstructor"](constructorExecution);
            } catch (error) {
                error.message = "Failed constructing service " + (constructor.key || String(service)) + ". " + error.message;
                throw error;
            }
        }

        if (!constructorPromises.length) {
            delete service[INTERNAL.property("constructing")];
            delete service[INTERNAL.property("promise")];
            if (constructorExecution) {
                constructorExecution.setDone();
                constructorExecution = undefined;
            }
        }
    }

    function setDataLifetimeInterval() {
        if (config.dataLifetime) {
            const serviceExecution = executionOf(service);
            const interval = setInterval(function () {
                if (serviceExecution.done) {
                    clearTimeout(interval);
                } else {
                    hydrateData(service);
                }
            }, config.dataLifetime);
            serviceExecution.onDone(function () {
                clearInterval(interval);
            });
        }
    }

    if (dataStore.has(service)) {
        const { data, error } = dataStore.getEntry(service);
        if (error ? config.handleDataError : config.handleData) {
            const dataExecution = ServiceDataExecution.from(executionOf(service));
            dataStore.setExecution(service, dataExecution);
            const handlePromise = error ? config.handleDataError(error, dataExecution) : config.handleData(data, dataExecution);
            if (handlePromise && handlePromise["then"]) {
                dataStore.setExecution(service, dataExecution);
                handlePromise.then(() => {
                    dataExecution.setDone();
                    dataStore.deleteExecution(service, dataExecution);
                    setDataLifetimeInterval();
                });
            } else {
                dataExecution.setDone();
                setDataLifetimeInterval();
            }
        } else {
            setDataLifetimeInterval();
        }

        setConstructionPromise();
    } else if (config.getData) {
        const returned = hydrateData(service);
        if (returned && returned["then"]) {
            returned.then(setDataLifetimeInterval);
        } else {
            setDataLifetimeInterval();
        }

        setConstructionPromise();
    } else {
        setConstructionPromise();
    }

    return service;
}

let missingKeys: Set<string>;

interface ConstructServiceProps<S extends Service, A extends any[]> {
    /** The service */
    constructor: ServiceConstructor<S, A>;
    context?: ServiceContext;
    args: A;
    id: ServiceIdentifier;
}
