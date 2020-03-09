import { Service } from "./service";

/** The class which all asynchronous and circularly-requiring services must extend. The promise returned by the `constructorAsync` method will define the constructing status. */
export class ServiceAsync extends Service {
    private $promise?: Promise<void>;
    private $constructed?: boolean;

    protected constructorAsync(): Promise<void> | void {
        return;
    }

    /** Private properties of a `ServiceAsync`. */
    static key = {
        ...Service.key,
        /** Resolves after `constructorAsync`. */
        promise: "$promise" as "$promise",
        /** Set as boolean after `constructorAsync` resolves. */
        constructed: "$constructed" as "$constructed",
    };

    static async constructAsync<T extends ServiceAsync>(service: T) {
        Object.defineProperty(service, ServiceAsync.key.promise, {
            value: Promise.resolve()
                .then(() => constructed)
                .then(() => {
                    Object.defineProperty(service, ServiceAsync.key.constructed, {
                        value: true,
                        configurable: false,
                        writable: false,
                        enumerable: false,
                    });
                }),
            configurable: false,
            writable: false,
            enumerable: false,
        });

        delete service[ServiceAsync.key.constructed];

        const constructed = service.constructorAsync();

        return service[ServiceAsync.key.promise];
    }
}
