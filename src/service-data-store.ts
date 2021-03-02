import { Service } from "./service";
import { ServiceDataExecution, ServiceExecution } from "./service-execution";
import { INTERNAL } from "./service-internal";
import { Class, ServiceData } from "./service-types";
import { parseQuery } from "./service-util";

export class ServiceDataStore {
    private readonly children: Set<ServiceDataStore>;

    readonly data = new Map<string, Map<string, ServiceDataEntry>>();
    readonly executions = new Map<string, Map<string, ServiceDataExecution | ServiceExecution>>();

    constructor(readonly parent?: ServiceDataStore) {
        this.children = new Set();

        if (parent) {
            parent.children.add(this);
        }
    }

    nest() {
        return new ServiceDataStore(this);
    }

    getEntry(service: Service) {
        return this.getEntryFromPath(ServiceDataStore.getKey(service), ServiceDataStore.getId(service));
    }

    protected getEntryFromPath<T>(key: string, id: string): ServiceDataEntry<T> | undefined {
        const store = this.findNearest((store) => store.data.has(key) && store.data.get(key).has(id));
        if (store) {
            return store.data.get(key).get(id);
        }
        return undefined;
    }

    has(service: Service) {
        return this.hasPath(ServiceDataStore.getKey(service), ServiceDataStore.getId(service));
    }

    delete(service: Service) {
        const key = ServiceDataStore.getKey(service);
        const id = ServiceDataStore.getId(service);
        if (this.getExecutionFromPath(key, id)) {
            console.warn(
                'Attempted to delete data with key "' +
                    key +
                    '"' +
                    (id ? ' and identifier "' + id + '"' : "") +
                    " while it's being retrieved, please hydrate the data instead. Ignoring.",
            );
            return false;
        }
        let deleted = false;
        if (this.data.has(key)) {
            const dataMap = this.data.get(key);
            deleted = dataMap.delete(id);
            if (deleted && !dataMap.size) {
                this.data.delete(key);
            }
        }
        if (this.clearCurrentExecutionFromPath(key, id)) {
            deleted = true;
        }
        return deleted;
    }

    protected hasPath(key: string, id: string): boolean {
        return !!this.findNearest((store) => store.data.has(key) && store.data.get(key).has(id));
    }

    getExecution(service: Service): ServiceDataExecution | ServiceExecution | void {
        const key = ServiceDataStore.getKey(service);
        const id = ServiceDataStore.getId(service);
        return this.getExecutionFromPath(key, id);
    }

    protected getExecutionFromPath(key: string, id: string): ServiceDataExecution | ServiceExecution | void {
        const store = this.findNearest((store) => store.executions.has(key) && store.executions.get(key).has(id));
        if (store) {
            return store.executions.get(key).get(id);
        }
        return undefined;
    }

    getExecutionPromise(service: Service): Promise<void> | void {
        const key = ServiceDataStore.getKey(service);
        const id = ServiceDataStore.getId(service);
        return this.getExecutionPromiseFromPath(key, id);
    }

    protected getExecutionPromiseFromPath(key: string, id: string): Promise<void> | void {
        const execution = this.getExecutionFromPath(key, id);
        if (!execution || execution.done) {
            return;
        }
        return execution.promise.then(async () => {
            const currentExecution = this.getExecutionFromPath(key, id);
            if (currentExecution && currentExecution !== execution) {
                return this.getExecutionPromiseFromPath(key, id);
            }
        });
    }

    /** Sets the current promise of a service. The passed promise can have a `promiseId` defined (extending `ServiceExecution`). If it does not have a `promiseId` defined,
     * a new promise will be created with a defined `promiseId` symbol. This allows for setting a new promise during the time the current promise is resolved, and still allowing
     * the promise returned from the `ServiceDataStore.promise` method to be resolved at the time that the most recently set promise is resolved. */
    setExecution(service: Service, execution: ServiceDataExecution | ServiceExecution): this {
        const key = ServiceDataStore.getKey(service);
        const id = ServiceDataStore.getId(service);
        const currentExecution = this.getExecutionFromPath(key, id);
        if (currentExecution) {
            this.executions.get(key).set(id, execution);
            if (currentExecution instanceof ServiceDataExecution) {
                currentExecution.setDone();
            }
        } else {
            if (!this.executions.has(key)) {
                this.executions.set(key, new Map());
            }
            this.executions.get(key).set(id, execution);
        }
        return this;
    }

    /** Deletes an execution in the specific store (does not delete promises in the parent or in children). If there is a current execution that has not yet been set to done, it will be. */
    clearCurrentExecution(service: Service): boolean {
        const key = ServiceDataStore.getKey(service);
        const id = ServiceDataStore.getId(service);
        return this.clearCurrentExecutionFromPath(key, id);
    }

    protected clearCurrentExecutionFromPath(key: string, id: string): boolean {
        const execution = this.getExecutionFromPath(key, id);
        if (execution) {
            this.deleteExecutionFromPath(key, id, execution);
            if (execution instanceof ServiceDataExecution) {
                execution.setDone();
            }
            return true;
        }
        return false;
    }

    /** Deletes an execution in the specific store (does not delete promises in the parent or in children). If there is a current execution that has not yet been set to done, it will be. */
    deleteExecution(service: Service, execution: ServiceDataExecution | ServiceExecution): boolean {
        if (!execution) {
            return false;
        }
        const key = ServiceDataStore.getKey(service);
        const id = ServiceDataStore.getId(service);
        return this.deleteExecutionFromPath(key, id, execution);
    }

    protected deleteExecutionFromPath(key: string, id: string, execution: ServiceDataExecution | ServiceExecution): boolean {
        const executions = this.executions.get(key);
        if (executions && executions.get(id) === execution) {
            executions.delete(id);
            if (!executions.size) {
                this.executions.delete(key);
            }
            return true;
        }
        return false;
    }

    /** Set the data of a service. If a exection exist for the data, that will be cleared (unless `doNotDeleteExecution`). */
    setEntry(service: Service, entry: ServiceDataEntry, doNotDeleteExecution = false): this {
        const key = ServiceDataStore.getKey(service);
        const id = ServiceDataStore.getId(service);
        return this.setEntryFromPath(key, id, entry, doNotDeleteExecution);
    }

    protected setEntryFromPath<T>(key: string, id: string, entry: ServiceDataEntry<T>, doNotDeleteExecution = false): this {
        if (!this.data.has(key)) {
            this.data.set(key, new Map());
        }
        this.data.get(key).set(id, entry);
        if (!doNotDeleteExecution) {
            // delete the current promise if one exists
            this.clearCurrentExecutionFromPath(key, id);
        }
        return this;
    }

    async promise(): Promise<ServiceDataStoreData> {
        await this.resolve();
        return this.get();
    }

    get(): ServiceDataStoreData {
        let data: ServiceData["data"];
        let dataErrors: ServiceData["dataErrors"];

        this.getKeys().forEach(([key, id]) => {
            const entry = this.getEntryFromPath(key, id);
            if (entry.error) {
                if (!dataErrors) {
                    dataErrors = {};
                }
                if (!dataErrors[key]) {
                    dataErrors[key] = {};
                }
                dataErrors[key] = entry.error;
            } else {
                if (!data) {
                    data = {};
                }
                if (!data[key]) {
                    data[key] = {};
                }
                if (entry.data === undefined) {
                    data[key][id] = null;
                } else {
                    data[key][id] = entry.data;
                }
            }
        });

        if (data) {
            Object.keys(data).forEach((key) => {
                const ids = Object.keys(data[key]);
                if (ids.length === 1 && ids[0] === ServiceDataStore.mapRootKey) {
                    data[key] = data[key][ServiceDataStore.mapRootKey];
                } else {
                    data[key][ServiceDataStore.mapKey] = 1;
                }
            });
        }

        if (dataErrors) {
            Object.keys(dataErrors).forEach((key) => {
                const ids = Object.keys(dataErrors[key]);
                if (ids.length === 1 && ids[0] === ServiceDataStore.mapRootKey) {
                    dataErrors[key] = dataErrors[key][ServiceDataStore.mapRootKey];
                } else {
                    dataErrors[key][ServiceDataStore.mapKey] = 1;
                }
            });
        }

        return { data, dataErrors };
    }

    set(d: ServiceDataStoreData) {
        const { data, dataErrors } = d;
        Object.keys(data || {}).forEach((key) => {
            let keyData = data[key];

            if (keyData && keyData[ServiceDataStore.mapKey]) {
                keyData = { ...keyData };
                delete keyData[ServiceDataStore.mapKey];

                Object.keys(keyData).forEach((id) => {
                    this.setEntryFromPath(key, id, { data: keyData[id] });
                });
            } else {
                this.setEntryFromPath(key, ServiceDataStore.mapRootKey, { data: keyData });
            }
        });
        Object.keys(dataErrors || {}).forEach((key) => {
            let keyDataErrors = dataErrors[key];

            if (keyDataErrors && keyDataErrors[ServiceDataStore.mapKey]) {
                keyDataErrors = { ...keyDataErrors };
                delete keyDataErrors[ServiceDataStore.mapKey];

                Object.keys(keyDataErrors).forEach((id) => {
                    this.setEntryFromPath(key, id, { error: keyDataErrors[id] });
                });
            } else {
                this.setEntryFromPath(key, ServiceDataStore.mapRootKey, { error: keyDataErrors });
            }
        });
    }

    async resolve() {
        await Promise.all(Array.from(this.getMappedPromises().values()));
    }

    findNearest(where: (store: ServiceDataStore) => unknown): ServiceDataStore | undefined {
        if (where(this)) {
            return this;
        } else if (this.parent && where(this.parent)) {
            return this.parent;
        }
        const child = Array.from(this.children).find(where);
        if (child) {
            return child;
        }
        return undefined;
    }

    protected getPromises(): Promise<void>[] {
        const promises: Promise<void>[] = this.getLocalPromises();
        if (this.parent) {
            promises.push(...this.parent.getLocalPromises());
        }
        Array.from(this.children).forEach((child) => promises.push(...child.getLocalPromises()));
        return promises;
    }

    protected getMappedPromises(): Map<string, Promise<void>> {
        const promises = new Map<string, Promise<void>>();
        this.getExecutions().forEach((executionMap, serviceKey) => {
            executionMap.forEach((execution, dataKey) => {
                const promiseKey = [serviceKey, dataKey].filter(Boolean).join(".");
                if (promises.has(promiseKey)) {
                    console.warn('Duplicate promise key "' + promiseKey + '".');
                }
                promises.set(promiseKey, execution.promise);
            });
        });
        return promises;
    }

    protected getExecutions(): Map<string, Map<string, ServiceDataExecution>> {
        const { executions, assign } = this.getExecutionsAssigner();
        this.assignExecutionsDown({ executions, assign });
        this.assignExecutionsUp({ executions, assign });
        assign(this.executions);
        return executions;
    }

    protected assignExecutionsUp({ executions, assign } = this.getExecutionsAssigner()) {
        if (this.parent) {
            assign(this.parent.executions);
            this.parent.assignExecutionsUp({ executions, assign });
        }
        return executions;
    }

    protected assignExecutionsDown({ executions, assign } = this.getExecutionsAssigner()) {
        if (!this.children || !this.children.size) {
            return;
        }
        Array.from(this.children).forEach((child) => {
            assign(child.executions);
            child.assignExecutionsDown({ executions, assign });
        });
        return executions;
    }

    protected getExecutionsAssigner() {
        const executions = new Map<string, Map<string, ServiceDataExecution>>();
        const assign = (assignExecutions: Map<string, Map<string, ServiceDataExecution>>) => {
            assignExecutions.forEach((assignExecutionMap, serviceKey) => {
                if (!executions.has(serviceKey)) {
                    executions.set(serviceKey, new Map(assignExecutionMap));
                } else {
                    const executionMap = executions.get(serviceKey);
                    assignExecutionMap.forEach((execution, dataKey) => {
                        if (executionMap.has(dataKey)) {
                            console.warn('Found duplicate entries for "' + serviceKey + "." + dataKey + '"');
                        }
                        executionMap.set(dataKey, execution);
                    });
                }
            });
        };
        return { executions, assign };
    }

    protected getLocalPromises(): Promise<void>[] {
        return Array.from(this.executions.values())
            .map((executions) => Array.from(executions.values()).map((execution) => execution.promise))
            .flat();
    }

    protected getKeys(): [string, string][] {
        const keys: [string, string][] = this.getLocalKeys();
        if (this.parent) {
            keys.push(...this.parent.getLocalKeys());
        }
        Array.from(this.children).forEach((child) => keys.push(...child.getLocalKeys()));
        return keys;
    }

    protected getLocalKeys(): [string, string][] {
        return Array.from(this.data.entries())
            .map(([key, data]) => Array.from(data.keys()).map((id) => [key, id] as [string, string]))
            .flat();
    }

    toString() {
        const strs: Record<string, string[]> = {};
        this.getKeys().forEach(([key, id]) => {
            if (!strs[key]) {
                strs[key] = [];
            }
            const entry = this.getEntryFromPath(key, id);
            const prefix = id === ServiceDataStore.mapRootKey ? "" : id + ": ";
            if (entry.error) {
                strs[key].push(prefix + String(entry.error));
            } else {
                strs[key].push(prefix + JSON.stringify(entry.data, null, 2));
            }
        });
        return (
            "ServiceDataStore({ " +
            Object.keys(strs)
                .map((key) => {
                    const prefix = key + ": ";
                    return prefix + "(" + strs[key].join(", ") + ")";
                })
                .join(", ") +
            " })"
        );
    }

    static getKey<T>(keyThunk: string | Service | Class<Service>): string {
        if (typeof keyThunk === "string") {
            return keyThunk;
        }
        const serviceClass = parseQuery(keyThunk).class;
        return serviceClass.key || serviceClass.name;
    }

    static getId(service: Service): string {
        const config = INTERNAL.get(service, "config");
        if (config) {
            if (config.getDataId) {
                const id = config.getDataId();
                if (id === undefined) {
                    return ServiceDataStore.mapRootKey;
                }
                return String(id);
            } else if (config.dataId !== undefined) {
                return String(config.dataId);
            }
        }
        const id = INTERNAL.get(service as any, "identifier");
        if (id === undefined) {
            return ServiceDataStore.mapRootKey;
        }
        return String(id);
    }

    static mapKey = "__m";
    static mapRootKey = "";

    static mergeData(...data: ServiceDataStoreData[]) {
        const merged: ServiceData = {} as any;
        data.forEach((data) => {
            if (!data) {
                return;
            }
            if (data.data) {
                merged.data = ServiceDataStore.mergeDataRecords(merged.data, data.data);
            }
            if (data.dataErrors) {
                merged.dataErrors = ServiceDataStore.mergeDataRecords(merged.dataErrors, data.dataErrors);
            }
        });
    }

    static mergeDataRecords(...data: ServiceDataStoreData["data"][]) {
        let merged: ServiceDataStoreData["data"];
        data.forEach((data) => {
            if (!data) {
                return;
            }
            if (merged) {
                Object.keys(data).forEach((key) => {
                    if (merged.hasOwnProperty(key)) {
                        if (merged[key] && merged[key][ServiceDataStore.mapKey]) {
                            if (data[key] && data[key][ServiceDataStore.mapKey]) {
                                merged[key] = { ...merged[key], ...data[key] };
                            } else {
                                merged[key] = { ...merged[key], [ServiceDataStore.mapRootKey]: data[key] };
                            }
                        } else {
                            if (data[key] && data[key][ServiceDataStore.mapKey]) {
                                merged[key] = { [ServiceDataStore.mapRootKey]: merged[key], ...data[key] };
                            } else {
                                merged[key] = data[key];
                            }
                        }
                    } else {
                        merged[key] = data[key];
                    }
                });
            } else {
                merged = { ...data };
            }
        });
        return merged;
    }
}

interface ServiceDataStoreData extends Pick<ServiceData, "data" | "dataErrors"> {}

export interface ServiceDataStoreProps {
    parent?: ServiceDataStore;
    /** If the store is static, no service will ever be re-constructed. */
    static?: boolean;
}

export interface ServiceDataEntry<T = any> {
    data?: T;
    error?: Error;
}
