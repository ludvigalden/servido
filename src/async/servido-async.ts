import { Servido } from "../core/servido";

import { ConstructingStatus } from "./servido-async.constructing-status";

export class ServidoAsync extends Servido {
    static async constructAsync<T extends ServidoAsync>(servido: T) {
        const stop = servido.constructing.start();

        const constructed = servido.constructorAsync();

        if (constructed && constructed.then) {
            return constructed.then(stop);
        } else {
            stop();
        }
    }

    /** If the servido is currently constructing. */
    constructing = new ConstructingStatus();

    protected constructorAsync(): Promise<void> | void {
        return;
    }
}
