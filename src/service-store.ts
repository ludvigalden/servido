import { ServiceDataStore } from "./service-data-store";
import { ServiceInstanceStore } from "./service-instance-store";

/** A `ServiceStore` contains values that are only available downwards. */
export class ServiceStore {
    readonly data: ServiceDataStore;
    readonly instance: ServiceInstanceStore;
    readonly globalData: ServiceDataStore | undefined;

    constructor(readonly parent?: ServiceStore, globalData?: ServiceDataStore) {
        if (parent) {
            this.data = parent.data.nest();
            this.instance = parent.instance.nest();
            if (globalData) {
                this.globalData = globalData;
            } else if (parent.globalData) {
                this.globalData = parent.globalData.nest();
            }
        } else {
            this.data = new ServiceDataStore();
            this.instance = new ServiceInstanceStore();
            if (globalData) {
                this.globalData = globalData;
            }
        }
    }

    nest() {
        return new ServiceStore(this);
    }
}
