import { Service } from "./service";
import { ServiceConfig } from "./service-config";
import { ServiceContext } from "./service-context";
import { ServiceDependent } from "./service-dependent";
import { ServiceExecution } from "./service-execution";
import { ServiceIdentifier } from "./service-types";

export interface Internal {
    set<K extends keyof InternalMap>(service: Service | ServiceDependent, key: K, value: InternalMap[K]): void;
    get<K extends keyof InternalMap>(service: Service | ServiceDependent, key: K): InternalMap[K];
    property<K extends keyof InternalMap>(key: K): any;
    defineProperty<K extends keyof InternalMap>(
        service: Service | ServiceDependent,
        key: K,
        value: InternalMap[K],
        descriptor: Omit<PropertyDescriptor, "value">,
    ): void;
}

interface InternalMap {
    promise: Promise<void> | undefined;
    identifier: ServiceIdentifier;
    constructing: boolean;
    deconstructFns: Set<Function>;
    context: ServiceContext;
    dependent: ServiceDependent;
    execution: ServiceExecution;
    config: ServiceConfig;
    name: string;
}

export const INTERNAL: Internal = {
    property(key) {
        return PREFIX + key;
    },

    set(service, key, value) {
        if (!service) {
            throw new Error('Unable to set "' + key + '" to "' + String(service) + '"');
        }
        service[INTERNAL.property(key)] = value as any;
    },

    get(service, key) {
        if (!service) {
            throw new Error('Unable to get "' + key + '" from "' + String(service) + '"');
        }
        return service[INTERNAL.property(key)] as any;
    },

    defineProperty(service, key, value, descriptor) {
        if (!service) {
            throw new Error('Unable to set "' + key + '" to "' + String(service) + '"');
        }
        Object.defineProperty(service, INTERNAL.property(key), { ...descriptor, value });
    },
};

const PREFIX = "__";
