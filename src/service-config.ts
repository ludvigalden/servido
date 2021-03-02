import { ServiceExecution } from "./service-execution";

export interface ServiceConfig<DT = any> {
    promise?: PromiseLike<void>;
    /** The amount of time (ms) that will be awaited until the service is deconstructed after having no dependents. */
    timeout?: number;
    /** If defined */
    getPromise?(execution: ServiceExecution): PromiseLike<void>;
    /** Used to get data that is critical for the service, if it has not been gotten already.
     * This essentially means that the service is not ready to be exposed until the data has been gotten.
     * If the service is constructed during server-side rendition, the request is passed as the first parameter. */
    getData?(execution: ServiceExecution): PromiseLike<DT> | DT;
    clearData?(): void;
    /** Returns the identifier for the retrieved initial data. Defaults to the identifier of the service, which is based on the arguments.
     * If the id is a number, it will be converted to a string. */
    getDataId?(): string | number;
    /** The identifier for the retrieved initial data. Defaults to the identifier of the service, which is based on the arguments.
     * If the id is a number, it will be converted to a string. */
    dataId?: string | number;
    /** Whether the initial data should be cached for future constructions of the service. If false, the data will be removed from the store when the service is deconstructed.
     * That is, unless the service context is static (for server-side rendering). Defaults to false. */
    cacheData?: boolean;
    /** The lifetime of the data. If defined, an interval is set from after the initial data has been retrieved that hydrates every `dataLifetime` ms.
     * That means fetching the data should take less time than the interval (in the future, we might implement that a timeout is set after the data is set instead) */
    dataLifetime?: number;
    /** Whether the data should exist in and be retrieved from the global data store, instead of the normal data store. The difference is that the global data store can be
     * a constant stored outside of a React context, and thus serve data for seperate rendering processes. This is pretty much just useful for server side rendering, because
     * a client normally just renders a single React tree to a single root element, where all services would share the same data store anyway. */
    globalData?: boolean;
    /** Returns `globalData` functionally, meaning the value will be retrieved every time servido wants to know whether the data should be stored in / retrieved from the global store. */
    getGlobalData?(): boolean;
    /** The lifetime of the global data, meaning it will be cached for the specified amount of milliseconds. */
    globalDataLifetime?: number;
    /** Used to set the gotten data for the service. If data already exists in the store or if the data is retrieved synchronously,
     * the method will be called synchronously when constructing the service. */
    handleData?(data: DT, execution: ServiceExecution): PromiseLike<void> | void;
    /** Used to handle an error thrown when retrieving the data. If undefined, the error will not be caught. */
    handleDataError?(error: Error, execution: ServiceExecution): PromiseLike<void> | void;
    /** Whether the data is not critical for the service to function. That means the service could be "resolved" before the data has been retrieved and handled. */
    uncriticalData?: boolean;
    /** Specifying a `cacheId` allows for generating a global cache identifier for a service context. */
    cacheId?: string | number;
    /** Allows for specifying the `cacheId` as a thunk. */
    getCacheId?(): string | number;
}
