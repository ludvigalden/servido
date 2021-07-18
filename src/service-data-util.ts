import { Service } from "./service";
import { ServiceConfig } from "./service-config";
import { ServiceContext } from "./service-context";
import { ServiceDataExecution, ServiceExecution } from "./service-execution";
import { INTERNAL } from "./service-internal";
import { configOf, executionOf } from "./service-util";

export function hydrateData<S extends Service>(
    service: S,
    parentExecution?: ServiceExecution,
    execution?: ServiceExecution,
): PromiseLike<DataOf<S>> | DataOf<S> {
    const { config, dataStore } = parseDataConfig(service);

    if (!config.getData) {
        return;
    }

    let promise: PromiseLike<DataOf<S> | void>;

    if (!parentExecution) {
        parentExecution = executionOf(service);
    }
    if (!execution) {
        execution = ServiceDataExecution.from(parentExecution);
        if (execution.done) {
            console.warn("Internal error: attempted to hydrate data for service with a done execution: ", service, ": ", execution);
            return;
        }
    } else if (execution.done) {
        console.warn("Attempted to hydrate data for service with a done execution: ", service, ": ", execution);
        return;
    } else {
        if (parentExecution !== execution) {
            execution = ServiceDataExecution.fromMany([parentExecution, execution]);
        } else {
            execution = ServiceDataExecution.from(parentExecution);
        }
    }

    if (config.clearData && dataStore.has(service)) {
        config.clearData();
    }

    dataStore.setExecution(service, execution);

    function setData() {
        const dataOrPromise: PromiseLike<DataOf<S>> | DataOf<S> = config.getData(execution) as any;

        if (dataOrPromise && dataOrPromise["then"]) {
            const dataPromise: PromiseLike<DataOf<S>> = dataOrPromise as any;
            promise = dataPromise.then((data) => {
                if (!execution.done) {
                    dataStore.setEntry(service, { data }, true);
                }
                return data;
            });
            promise = (promise as Promise<DataOf<S>>).catch((error) => {
                if (!execution.done) {
                    dataStore.setEntry(service, { error }, true);
                }
            });
        } else {
            const data: DataOf<S> = dataOrPromise as any;
            dataStore.setEntry(service, { data }, true);
        }
    }

    try {
        setData();
    } catch (error) {
        dataStore.setEntry(service, { error }, true);
    }

    if (promise) {
        promise = promise.then((v) => {
            if (!execution.done) {
                const { data, error } = dataStore.getEntry(service);
                if (error || config.handleData) {
                    const handlePromise = error
                        ? config.handleDataError
                            ? config.handleDataError(error, execution)
                            : console.error(
                                  "Failed retrieving data for " +
                                      String(service) +
                                      ". Please consider adding a `handleDataError function to the service config.`",
                              )
                        : config.handleData(data as any, execution);
                    if (handlePromise && handlePromise["then"]) {
                        return handlePromise.then(() => v);
                    }
                }
            }
            return v;
        });
    } else {
        const { data, error } = dataStore.getEntry(service);

        if (error || config.handleData) {
            const handlePromise = error
                ? config.handleDataError
                    ? config.handleDataError(error, execution)
                    : console.error(
                          "Failed retrieving data for " +
                              String(service) +
                              ". Please consider adding a `handleDataError function to the service config.`",
                      )
                : config.handleData(data as any, execution);
            if (handlePromise && handlePromise["then"]) {
                promise = Promise.resolve(handlePromise);
            }
        }
    }

    if (promise) {
        promise.then(() => {
            if (execution instanceof ServiceDataExecution) {
                execution.setDone();
            }
            dataStore.deleteExecution(service, execution);
        });
        return Promise.resolve(dataStore.getExecutionPromise(service)).then(() => {
            if (dataStore.has(service)) {
                return dataStore.getEntry(service).data as DataOf<S>;
            }
        });
    } else {
        if (execution instanceof ServiceDataExecution) {
            execution.setDone();
        }
        dataStore.deleteExecution(service, execution);
    }

    if (dataStore.has(service)) {
        return dataStore.getEntry(service).data as DataOf<S>;
    }
}

/** Resolves the data for a service. If it has already been gotten, the data will be returned synchronously. */
export function resolveData<S extends Service>(service: S): PromiseLike<DataOf<S>> | DataOf<S> {
    const { dataStore } = parseDataConfig(service);
    const executionPromise = dataStore.getExecutionPromise(service);
    if (executionPromise) {
        return executionPromise.then(() => {
            if (dataStore.has(service)) {
                return dataStore.getEntry(service).data;
            }
        }) as PromiseLike<DataOf<S>>;
    } else if (dataStore.has(service)) {
        return dataStore.getEntry(service).data as PromiseLike<DataOf<S>> | DataOf<S>;
    }
}

/** Deletes the data for a service if it has been retrieved. */
export function deleteData<S extends Service>(service: S): boolean {
    const { dataStore } = parseDataConfig(service);
    return dataStore.delete(service);
}

/** Sets the data for a service. */
export function setData<S extends Service>(service: S, data: DataOf<S>) {
    const { dataStore } = parseDataConfig(service);
    dataStore.setEntry(service, { data });
}

type DataOf<S extends Service> = S extends {
    getServiceConfig(): ServiceConfig<infer T>;
}
    ? T
    : S extends {
          serviceConfig: ServiceConfig<infer T>;
      }
    ? T
    : any;

export function parseDataConfig<S extends Service>(service: S) {
    const context = INTERNAL.get(service, "context") || ServiceContext.default;
    const config = configOf<S>(service) || {};
    const globalData = Boolean(config.getGlobalData ? config.getGlobalData() : config.globalData);
    const dataStore = globalData ? context.globalData || context.data : context.data;
    const cacheData = Boolean(globalData || config.cacheData);
    return {
        config,
        dataStore,
        context,
        globalData,
        cacheData,
    };
}
