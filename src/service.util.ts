import { Service } from "./service";
import { ServiceAsync } from "./service-async";

/** Resolve the promise returned by the `constructorAsync` method of every passed `ServiceAsync`. */
export async function resolveServices<S extends (Service | undefined)[]>(...services: S) {
    return Promise.all(services.map((service) => (service ? service[ServiceAsync.key.promise as never] : undefined))).then(() => services);
}

/** Check if any of the passed services are currently constructing. */
export function constructingServices(...services: Service[]): boolean {
    return services.some((service) => service instanceof ServiceAsync && !service[ServiceAsync.key.constructed]);
}
