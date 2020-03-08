import { Service } from "../core/service";

import { ServiceConstructingStatus } from "./service-async.constructing-status";

export class ServiceAsync extends Service {
    static async constructAsync<T extends ServiceAsync>(service: T) {
        const stop = service.constructing.start();

        const constructed = service.constructorAsync();

        if (constructed && constructed.then) {
            return constructed.then(stop);
        } else {
            stop();
        }
    }

    /** If the service is currently constructing. */
    constructing = new ServiceConstructingStatus();

    protected constructorAsync(): Promise<void> | void {
        return;
    }
}
