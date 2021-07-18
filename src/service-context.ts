import React from "react";

import { Service, ServiceConstructor, ServiceQuery } from "./service";
import { ServiceDataStore } from "./service-data-store";
import { resolveData } from "./service-data-util";
import { ServiceDependent } from "./service-dependent";
import { INTERNAL } from "./service-internal";
import { ServiceStore } from "./service-store";
import { ServiceData, ServiceIdentifier } from "./service-types";
import { doesQueryMatch } from "./service-util";

import { IncomingMessage } from "http";

/** Contains the currently constructed services, dependents and requirements. */
export class ServiceContext {
    private readonly dependents: Map<Service, Set<ServiceDependent>>;
    private readonly requirements: Map<ServiceDependent, Set<Service>>;

    private defaultIds?: Map<ServiceConstructor, ServiceIdentifier>;
    private proxy?: Map<ServiceQuery<Service>, ServiceQuery<Service>>;

    private _store?: ServiceStore;
    private _params?: ServiceContextProps["params"];
    private _staticData?: boolean;
    private _nested?: Map<ServiceIdentifier, ServiceContext>;

    readonly key = String(keyIndex++);

    readonly static: boolean;
    readonly parent?: ServiceContext;
    readonly children: Set<ServiceContext>;

    constructor(props: ServiceContextProps = {}) {
        this.dependents = new Map();
        this.requirements = new Map();
        this.children = new Set();

        if (props.parent) {
            this.static = !!(props.static || props.parent.static);
            this.parent = props.parent;
            props.parent.children.add(this);

            if (props.nestStore) {
                this._store = new ServiceStore(props.parent.store, props.globalDataStore);
            }
        } else {
            this.static = !!props.static;
            this._store = new ServiceStore(undefined, props.globalDataStore);
        }

        if (typeof props.staticData === "boolean") {
            this._staticData = props.staticData;
        }

        if (props.params) {
            this._params = props.params;
        } else {
            delete this._params;
        }

        if (props.data) {
            this.setData(props.data);
        }
    }

    getId<A extends any[]>(constructor: ServiceConstructor<Service, A>, args: A): ServiceIdentifier {
        if (args && args.length && !args.every((arg) => arg === undefined)) {
            if (!constructor) {
                return Service.identifier(...args);
            }
            return (((constructor as any) as typeof Service).identifier || Service.identifier)(...args);
        } else {
            if (!constructor) {
                return undefined;
            }
            const defaultId = this.getDefaultId(constructor);
            if (defaultId !== undefined) {
                return defaultId;
            } else if (constructor.identifier && constructor.identifier !== Service.identifier) {
                if (args) {
                    return constructor.identifier(...args);
                } else {
                    return (constructor as any).identifier();
                }
            }
        }
    }

    parseQuery<S extends Service>(query: ServiceQuery<S>): ServiceQuery<S> {
        let parsedQuery = query;
        let foundProxy = this.getProxy(query);
        while (foundProxy) {
            parsedQuery = foundProxy as any;
            foundProxy = this.getProxy(parsedQuery);
        }
        return parsedQuery;
    }

    setDefaultId(constructor: ServiceConstructor, id: ServiceIdentifier) {
        if (!this.defaultIds) {
            this.defaultIds = new Map();
        }
        this.defaultIds.set(constructor, id);
        return this;
    }

    setProxy(proxy: ServiceQuery<Service>, query: ServiceQuery<Service>) {
        if (!this.proxy) {
            this.proxy = new Map();
        }
        this.proxy.set(proxy, query);
        return this;
    }

    deleteProxy(proxy: ServiceQuery<Service>) {
        if (!this.proxy) {
            return this;
        }
        this.proxy.delete(proxy);
        return this;
    }

    protected getDefaultId<A extends any[]>(constructor: ServiceConstructor<Service, A>): ServiceIdentifier | undefined {
        if (this.defaultIds && this.defaultIds.has(constructor as ServiceConstructor)) {
            return this.defaultIds.get(constructor as ServiceConstructor);
        } else if (this.parent) {
            return this.parent.getDefaultId(constructor);
        }
    }

    protected getProxy(query: ServiceQuery<Service>): ServiceQuery<Service> {
        if (this.proxy) {
            const found = Array.from(this.proxy.keys()).find((proxyKey) => doesQueryMatch(this, query, proxyKey));
            if (found) {
                return this.proxy.get(found);
            }
        }
        if (this.parent) {
            return this.parent.getProxy(query);
        }
    }

    addRequirement(dependent: ServiceDependent, service: Service) {
        this.instance["addRequirement"](dependent, service);

        let contextRequirements = this.requirements.get(dependent);
        if (!contextRequirements) {
            contextRequirements = new Set();
            this.requirements.set(dependent, contextRequirements);
        }
        contextRequirements.add(service);

        let contextDependents = this.dependents.get(service);
        if (!contextDependents) {
            contextDependents = new Set();
            this.dependents.set(service, contextDependents);
        }
        contextDependents.add(dependent);
    }

    deleteRequirement(dependent: ServiceDependent, service: Service): boolean {
        const deleted = this.instance["deleteRequirement"](dependent, service);

        const contextRequirements = this.requirements.get(dependent);
        if (contextRequirements) {
            contextRequirements.delete(service);
            if (!contextRequirements.size) {
                this.requirements.delete(dependent);
            }
        }

        const contextDependents = this.dependents.get(service);
        if (contextDependents) {
            contextDependents.delete(dependent);
            if (!contextDependents.size) {
                this.dependents.delete(service);
            }
        }

        return deleted;
    }

    /** Returns all of the required services locally and upwards. */
    get requiredUp(): Set<Service> {
        const required = new Set(this.dependents.keys());
        Array.from(required).forEach((service) => {
            const requirements = this.instance.getRequirements(service);
            if (requirements) {
                Array.from(requirements).forEach((requirement) => required.add(requirement));
            }
        });
        if (this.parent) {
            Array.from(this.parent.requiredUp).forEach((service) => required.add(service));
        }
        return required;
    }

    /** Ensures that all required data has been loaded. */
    get promiseDataRequirements() {
        return Promise.resolve().then(async () => {
            await Promise.all(
                Array.from(this.required).map(async (service) => {
                    await resolveData(service);
                }),
            );
        });
    }

    /** Returns all of the required services locally and upwards. */
    get requiredDown(): Set<Service> {
        const required = new Set(this.dependents.keys());
        Array.from(required).forEach((service) => {
            const requirements = this.instance.getRequirements(service);
            if (requirements) {
                Array.from(requirements).forEach((requirement) => required.add(requirement));
            }
        });
        Array.from(this.children).forEach((child) => Array.from(child.requiredDown).forEach((service) => required.add(service)));
        return required;
    }

    /** Returns all of the required services locally and upwards. */
    get childrenRequired(): Set<Service> {
        const required = new Set(this.dependents.keys());
        Array.from(this.children).forEach((child) => Array.from(child.requiredDown).forEach((service) => required.add(service)));
        return required;
    }

    /** Returns all of the required services in line with the context (from parents and children) */
    get required(): Set<Service> {
        const required = this.requiredUp;
        Array.from(this.requiredDown).forEach((service) => required.add(service));
        return required;
    }

    /** Sets whether data should not be cleared after deconstructing a service. */
    setStaticData(staticData = true) {
        this._staticData = staticData;
    }

    get staticData(): boolean {
        if (typeof this._staticData === "boolean") {
            return this._staticData;
        } else {
            return this.static || (this.parent ? this.parent.staticData : false);
        }
    }

    nest(id?: ServiceIdentifier, props: Omit<ServiceContextProps, "parent"> = {}) {
        let context: ServiceContext;
        if (id !== undefined) {
            if (!this._nested) {
                this._nested = new Map();
            } else if (this._nested.has(id)) {
                return this._nested.get(id);
            }
            context = new ServiceContext({ ...props, parent: this });
            this._nested.set(id, context);
        } else {
            context = new ServiceContext({ ...props, parent: this });
        }
        return context;
    }

    findNearest(where: (context: ServiceContext) => unknown): ServiceContext | undefined {
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

    /** Returns Data that can be transferred between contexts to ensure initial data and params. */
    async promiseData(): Promise<ServiceData> {
        if (!this.staticData) {
            console.warn(`The "getData" method is intended to be used along with static contexts.`);
        }
        if (this.globalData) {
            await Promise.all([this.data.promise(), this.globalData.promise()]);
        } else {
            await this.data.promise();
        }
        return this.getData();
    }

    /** Returns Data that can be transferred between contexts to ensure initial data and params. */
    getData(): ServiceData {
        if (!this.staticData) {
            console.warn(`The "getData" method is intended to be used along with static contexts.`);
        }
        const data = this.data.get();
        const serviceData: ServiceData = { ...data, params: this.params } as any;
        if (this.globalData) {
            const globalData = this.globalData.get();
            if (globalData.data) {
                serviceData.globalData = globalData.data;
            }
            if (globalData.dataErrors) {
                serviceData.globalDataErrors = globalData.dataErrors;
            }
        }
        return serviceData;
    }

    /** Used to set Data that has previously been retrieved using the `getData` method. */
    setData(data: ServiceData) {
        if (this._params) {
            const previousParams = this._params;
            const dataParams = data.params;
            if (typeof previousParams === "function") {
                this._params = (currentParams) => previousParams({ ...dataParams, ...currentParams });
            } else {
                this._params = { ...dataParams, ...previousParams };
            }
        } else {
            this._params = data.params;
        }
        if (this.globalData) {
            this.globalData.set({
                data: data.globalData,
                dataErrors: data.globalDataErrors,
            });
            this.data.set({
                data: data.data,
                dataErrors: data.dataErrors,
            });
        } else {
            this.data.set({
                data:
                    data.data && data.globalData
                        ? ServiceDataStore.mergeDataRecords(data.data, data.globalData)
                        : data.data || data.globalData,
                dataErrors:
                    data.dataErrors && data.globalDataErrors
                        ? ServiceDataStore.mergeDataRecords(data.dataErrors, data.globalDataErrors)
                        : data.dataErrors || data.globalDataErrors,
            });
        }
    }

    get store(): ServiceStore {
        if (this._store) {
            return this._store;
        } else if (this.parent) {
            return this.parent.store;
        } else {
            throw new Error("A `ServiceContext` was constructed without a store or parent with a store");
        }
    }

    get params(): servido.Params {
        const params: servido.Params = this.parent ? this.parent.params : ({} as any);
        if (this._params) {
            if (typeof this._params === "function") {
                Object.assign(params, this._params(params));
            } else {
                Object.assign(params, this._params);
            }
        }
        return params;
    }

    get cacheId(): string {
        return Array.from(this.requiredDown)
            .map((service) => {
                const config = INTERNAL.get(service, "config") || {};
                return [
                    Service.key || INTERNAL.get(service, "name"),
                    INTERNAL.get(service, "identifier"),
                    config.getCacheId ? config.getCacheId() : config.cacheId,
                ]
                    .filter((v) => v !== undefined)
                    .join(";");
            })
            .sort((a, b) => a.localeCompare(b))
            .join(":");
    }

    get childrenCacheId(): string {
        return Array.from(this.requiredDown)
            .map((service) => {
                const config = INTERNAL.get(service, "config") || {};
                return [
                    Service.key || INTERNAL.get(service, "name"),
                    INTERNAL.get(service, "identifier"),
                    config.getCacheId ? config.getCacheId() : config.cacheId,
                ]
                    .filter((v) => v !== undefined)
                    .join(";");
            })
            .sort((a, b) => a.localeCompare(b))
            .join(":");
    }

    get data() {
        return this.store.data;
    }
    get globalData() {
        return this.store.globalData;
    }
    get instance() {
        return this.store.instance;
    }
    get root() {
        if (this.parent) {
            return this.parent.root;
        } else {
            return this;
        }
    }

    /** Use the `ServiceContext` provided, or default to the global context that is shared by all other components not being contained by a provider. */
    static use() {
        return React.useContext(this.reactContext);
    }

    /** Get the `ServiceContext` using a possibly defined argument. */
    static get(source?: ServiceContext | Service | ServiceDependent): ServiceContext {
        if (source) {
            if (source instanceof ServiceContext) {
                return source;
            } else {
                return INTERNAL.get(source, "context") || ServiceContext.default;
            }
        } else {
            return ServiceContext.default;
        }
    }

    /** Get the `servido.Params` using a possibly defined argument. */
    static getParams(source?: ServiceContext | Service): servido.Params {
        return this.get(source).params;
    }

    /** The default context used when no `ServiceContextProvider` is providing the context. */
    static default: ServiceContext;

    /** The `React.Context` used for providing and consuming `ServiceContext`:s */
    static reactContext: React.Context<ServiceContext>;

    static get Provider() {
        return this.reactContext.Provider;
    }

    static get Consumer() {
        return this.reactContext.Consumer;
    }
}

let keyIndex = 0;

ServiceContext.default = new ServiceContext();
ServiceContext.reactContext = React.createContext(ServiceContext.default);
ServiceContext.reactContext.displayName = "ServiceContext";

export interface ServiceContextProps {
    /** The parent context. */
    parent?: ServiceContext;
    /** If the `store` of the `parent` should be nested. */
    nestStore?: boolean;
    /** If the context is static, no service will ever be re-constructed. */
    static?: boolean;
    /** If `true`, data will never be deleted when deconstructing a service. It can be
     * unset at a later time using the `ServiceContext` instance. */
    staticData?: boolean;
    /** If defined, global data can be  */
    globalDataStore?: ServiceDataStore;
    /** Params to assign to the current parameters. */
    params?: Partial<servido.Params> | ((current: servido.Params) => Partial<servido.Params>);
    data?: ServiceData;
}

declare global {
    namespace servido {
        /** The context provided to services. */
        interface Params {
            request?: Request;
        }

        /** The assumed type of the request. It's declared here to allow for declaring additional properties.
         * @example
         * declare global {
         *     namespace servido {
         *         interface Request extends Express.Request {}
         *     }
         * }
         */
        interface Request extends IncomingMessage {}
    }
}
