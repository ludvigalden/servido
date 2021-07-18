import { Service, ServiceConstructor } from "./service";
import { ServiceDependent } from "./service-dependent";
import { Class, ServiceIdentifier } from "./service-types";

/** Contains the currently constructed services, dependents and requirements. */
export class ServiceInstanceStore {
    protected readonly constructed = new Map<ServiceConstructor, Map<ServiceIdentifier, Service>>();
    protected readonly constructing = new Map<Service, Promise<void>>();
    protected readonly constructors = new Map<Service, ServiceConstructor>();
    protected readonly clearIds = new Map<Service, symbol>();
    protected readonly dependents = new Map<Service, Set<ServiceDependent>>();
    protected readonly requirements = new Map<ServiceDependent, Set<Service>>();
    protected readonly circularRequirements = new Map<Service, Set<Service>>();
    protected readonly circularDependents = new Map<Service, Set<Service>>();
    protected readonly errorListeners = new Set<(error: Error) => void>();

    constructor(readonly parent?: ServiceInstanceStore) {}

    has(service: Service): boolean {
        return !!this.find((i) => i.constructors.has(service));
    }

    protected addRequirement(dependent: ServiceDependent, service: Service) {
        this.ensureDependents(service).add(dependent);
        this.ensureRequirements(dependent).add(service);
    }
    /** Deletes a requirement of a dependent and deletes the set of requirements if it is empty. */
    protected deleteRequirement(dependent: ServiceDependent, service: Service): boolean {
        let deleted = false;

        const dependents = this.dependents.get(service);
        if (dependents) {
            deleted = dependents.delete(dependent);
            if (!dependents.size) {
                this.dependents.delete(service);
            }
        }
        const requirements = this.requirements.get(dependent);
        if (requirements) {
            deleted = requirements.delete(service);
            if (!requirements.size) {
                this.requirements.delete(dependent);
            }
        }

        if (dependent instanceof Service) {
            this.deleteCircularRequirement(dependent, service);
        }

        return deleted;
    }
    hasRequirement(dependent: ServiceDependent, service: Service): boolean {
        const requirements = this.getRequirements(dependent);
        return requirements ? requirements.has(service) : false;
    }
    getRequirements(dependent: ServiceDependent): Set<Service> | undefined {
        return this.requirements.get(dependent);
    }
    /** Ensures a set of required services for a dependent (does not iterate through parents since the context of dependents will always be the same). */
    protected ensureRequirements(dependent: ServiceDependent): Set<Service> {
        let requirements = this.getRequirements(dependent);
        if (!requirements) {
            requirements = new Set();
            this.requirements.set(dependent, requirements);
        }
        return requirements;
    }

    hasDependents(service: Service): boolean {
        return !!this.getDependents(service);
    }
    protected getDependents(service: Service): Set<ServiceDependent | undefined> {
        const found = this.find((i) => i.dependents.has(service));
        return found ? found.dependents.get(service) : undefined;
    }
    protected ensureDependents(service: Service): Set<ServiceDependent> {
        let dependents = this.getDependents(service);
        if (!dependents) {
            dependents = new Set();
            this.dependents.set(service, dependents);
        }
        return dependents;
    }

    addCircularRequirement(dependent: Service, service: Service) {
        this.ensureCircularRequirements(dependent).add(service);
        this.ensureCircularDependents(service).add(dependent);
    }
    protected deleteCircularRequirement(dependent: Service, service: Service): boolean {
        let deleted = false;

        const requirements = this.getCircularRequirements(dependent);
        if (requirements) {
            deleted = requirements.delete(service);
            if (!requirements.size) {
                this.circularRequirements.delete(dependent);
            }
        }

        const dependents = this.getCircularDependents(service);
        if (dependents) {
            deleted = dependents.delete(dependent);
            if (!requirements.size) {
                this.circularRequirements.delete(service);
            }
        }

        return deleted;
    }
    protected getCircularRequirements(dependent: Service): Set<Service> | undefined {
        return this.circularRequirements.get(dependent);
    }
    /** Ensures a set of required services for a dependent (does not iterate through parents since the context of dependents will always be the same). */
    protected ensureCircularRequirements(dependent: Service): Set<Service> {
        let requirements = this.getCircularRequirements(dependent);
        if (!requirements) {
            requirements = new Set();
            this.circularRequirements.set(dependent, requirements);
        }
        return requirements;
    }

    protected getCircularDependents(dependent: Service): Set<Service> | undefined {
        return this.circularDependents.get(dependent);
    }
    /** Ensures a set of required services for a dependent (does not iterate through parents since the context of dependents will always be the same). */
    protected ensureCircularDependents(dependent: Service): Set<Service> {
        let requirements = this.getCircularDependents(dependent);
        if (!requirements) {
            requirements = new Set();
            this.circularDependents.set(dependent, requirements);
        }
        return requirements;
    }

    /** Ensures a map of constructed services for a constructor (does not iterate through parents since instances should always be stored nearest, and only fallback to parents). */
    ensureLocalConstructedMap(constructor: ServiceConstructor): Map<ServiceIdentifier, Service> {
        let constructed = this.constructed.get(constructor);
        if (!constructed) {
            constructed = new Map();
            this.constructed.set(constructor, constructed);
        }
        return constructed;
    }
    hasConstructed(constructor: ServiceConstructor, id: ServiceIdentifier): boolean {
        return !!this.find((i) => i.constructed.has(constructor) && i.constructed.get(constructor).has(id));
    }
    /** Gets the nearest constructed instance with the same `id`. If the `id` is undefined, it wil fallback to find the nearest instance. */
    getConstructed(constructor: ServiceConstructor, id: ServiceIdentifier): Service | undefined {
        let found = this.find((i) => i.constructed.has(constructor) && i.constructed.get(constructor).has(id));
        if (!found && id === undefined) {
            found = this.find((i) => i.constructed.has(constructor));
            if (found) {
                return found.constructed.get(constructor).values().next().value;
            }
        } else if (found) {
            return found.constructed.get(constructor).get(id);
        }
    }
    /** Deletes the nearest constructed service with a specific id. */
    deleteConstructed(constructor: ServiceConstructor, id: ServiceIdentifier) {
        const found = this.find((i) => i.constructed.has(constructor) && i.constructed.get(constructor).has(id));
        if (!found) {
            return false;
        }
        const constructedMap = found.constructed.get(constructor);
        const constructed = constructedMap.get(id);
        if (constructed) {
            found.constructors.delete(constructed);
        }
        const deleted = constructedMap.delete(id);
        if (!constructedMap.size) {
            found.constructed.delete(constructor);
        }
        return deleted;
    }
    setConstructed(constructor: ServiceConstructor, id: ServiceIdentifier, service: Service) {
        this.ensureLocalConstructedMap(constructor).set(id, service);
        this.constructors.set(service, constructor);
    }

    setConstructing(service: Service, promise: Promise<void>) {
        const found = this.find((i) => i.constructors.has(service));
        if (found) {
            found.constructing.set(service, promise);
        } else {
            this.constructing.set(service, promise);
        }
    }
    getConstructing(service: Service): Promise<void> | undefined {
        const found = this.find((i) => i.constructing.has(service));
        if (found) {
            return found.constructing.get(service);
        }
    }
    deleteConstructing(service: Service): boolean {
        const found = this.find((i) => i.constructing.has(service));
        if (found) {
            return found.constructing.delete(service);
        }
        return false;
    }

    protected getConstructedSetUp<T extends Service>(constructor: Class<T>): Set<T> {
        const set = new Set<T>();

        if (this.constructed.has(constructor)) {
            Array.from(this.constructed.get(constructor).values()).forEach((service) => set.add(service as T));
        }
        if (this.parent) {
            Array.from(this.parent.getConstructedSetUp(constructor)).forEach((service) => set.add(service));
        }
        return set;
    }
    getConstructedSet(constructor: ServiceConstructor): Set<Service> {
        return this.getConstructedSetUp(constructor);
    }
    protected getConstructedIdsUp(constructor: ServiceConstructor): Set<ServiceIdentifier> {
        const set = new Set<ServiceIdentifier>();

        if (this.constructed.has(constructor)) {
            Array.from(this.constructed.get(constructor).keys()).forEach((id) => set.add(id));
        }
        if (this.parent) {
            Array.from(this.parent.getConstructedIdsUp(constructor)).forEach((service) => set.add(service));
        }
        return set;
    }
    getConstructedIds(constructor: ServiceConstructor): Set<ServiceIdentifier> {
        return this.getConstructedIdsUp(constructor);
    }

    getConstructor(service: Service): ServiceConstructor | undefined {
        return this.constructors.get(service);
    }
    deleteConstructor(service: Service): boolean {
        this.clearIds.delete(service);
        return this.constructors.delete(service);
    }

    getClearId(service: Service): symbol | undefined {
        return this.clearIds.get(service);
    }

    setClearId(service: Service, clearId: symbol): symbol {
        this.clearIds.set(service, clearId);
        return clearId;
    }

    deleteClearId(service: Service): boolean {
        return this.clearIds.delete(service);
    }

    nest(): ServiceInstanceStore {
        return new ServiceInstanceStore(this);
    }

    find(where: (instances: ServiceInstanceStore) => unknown): ServiceInstanceStore | undefined {
        if (where(this)) {
            return this;
        } else if (this.parent && where(this.parent)) {
            return this.parent;
        }
        return undefined;
    }

    onError(listener: (error: Error) => void) {
        this.errorListeners.add(listener);
        return () => this.errorListeners.delete(listener);
    }

    protected notifyError(error: Error) {
        if (this.errorListeners.size) {
            this.errorListeners.forEach((listener) => {
                try {
                    listener(error);
                } catch (error) {
                    console.warn("Attempted to throw error notified to service error listener. Do something else.");
                }
            });
        } else {
            console.error(error);
        }
    }
}
