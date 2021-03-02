
<p align="center">
  <img src="https://user-images.githubusercontent.com/30798446/76160358-d5fe7d00-6129-11ea-977c-fef96bb46a12.png" width="230" height="230" alt="Servido.js" />
</p>

<h3 align="center">
  Services for React &nbsp;⚗️
</h3>

<br>

[![Stable Release](https://img.shields.io/npm/v/servido.svg)](https://npm.im/servido)
[![Blazing Fast](https://badgen.now.sh/badge/speed/blazing%20%F0%9F%94%A5/green)](https://npm.im/servido)
[![gzip size](http://img.badgesize.io/https://unpkg.com/servido@latest/dist/servido.umd.production.min.js?compression=gzip)](https://unpkg.com/servido@latest/dist/servido.umd.production.min.js)
[![license](https://badgen.now.sh/badge/license/MIT)](./LICENSE)

---

React provides great tools for working with the component lifecycle. In some applications, these tools would be sufficient. In large or complex applications, though, where components communicate with each other and use the same state extensively, using the tools provided by React requires you to write a lot of code that might not be very performant or easy to read. These are the very issues *servido* aims to be a solution for.

Now, to get a base understanding of what servido can do for you, let's break it down to its most important concepts and features.

## Services

Everything about servido builds on the idea of services. A service can be used by React components or other services. It can hold state, provide methods for executing actions, be constructed asynchronously or synchronously, use cached data, and essentially whatever you want to do. A service is defined by extending the exported `Service` class, like so:

```typescript
import { Service } from "servido";

class MyUtilityService extends Service {
    protected index: number = 0;

    increment(): number {
        return this.index++
    }
}
```

## Dependents

So why can't I just skip the `Service` part and construct `MyUtilityService` lika normal class? Well, in this case, you certainly can, because `MyUtilityService` doesn't do much that actually utilizes the power of `servido`. As mentioned, `servido` provides a cloud of services that *depend* on each other. A service can be dependent on other services, but React components can also depend on services, like so:

```typescript
import { Service, useService } from "servido";

class MyGreatService extends Service {
    readonly utility: MyUtilityService;

    constructor() {
        super();

        this.utility = this.require(MyUtilityService);
    }
}

export function MyGreatComponent(): JSX.Element {
    const myGreatService = useService(MyGreatService);
    const myUtilityService = useService(MyUtilityService);
    // myGreatService.utility === myUtilityService
    return null
}
```

Additionally, there are *service agents* that is both a dependent and provide public methods for requiring services based on a parent dependent. Most often, the parent dependent will be a service that uses something that might not be a service. They are used like so:

```typescript
import { Service, ServiceAgent } from "servido";

class MyService extends Service {
    constructor() {
        super();

        const agent = new ServiceAgent(this);

        agent.require(MyService);
        // throws a range error (circular requirement) ... more on that later
    }
}
```

## Identified services

In the examples above, the constructors of the services do not accept any arguments. There are cases where you want multiple instances of the same service, though. For example, you might want a utility with a common interface that based on dynamically defined values.

```typescript
import { Service } from "servido";

class CarsStore extends Service {
    cars: Car[];

    constructor(readonly brand: string) {
        super();

        this.cars = CarsStore.cars[brand];
    }

    static cars: Record<string, Car[]>;
}
```

As a special case, if no arguments are passed when requiring a service (or just undefined arguments), a service that was constructed previously *with arguments* might be returned. That is, no arguments means "whatever arguments". The generated identifier for the arguments is always a primitive value, so if there are arguments that must be identified but are not primitive values, a custom `static identifier(args)` should be defined. The identifier method can also be defined to provide fallbacks, like so:

```typescript
import { Service } from "servido";

class CarsStore extends Service {
    ...

    static identifier(brand: string) {
        return brand || "volvo";
    }
}
```

## Asynchronicity

Many services depend on asynchronicity on some level, for example HTTP-requests. Also, there are situations where services might depend on each other. ... you can use the `asyncConstructor` method, which is called by `servido` when constructing the service.

```typescript
import { Service } from "servido";

class ResolvedWhenReady extends Service {
    protected async asyncConstructor() {
        await new Promise((resolve) => setTimeout(resolve, 1500));
    }
}

class AsyncUtilityService extends Service {
    protected index: number = 0;

    protected readonly resolvedWhenReady: ResolvedWhenReady;

    constructor() {
        super();

        this.resolvedWhenReady = this.require(ConstructedWhenReady);
    }

    async incrementWhenReady(): Promise<number> {
        await Service.resolve(this.resolvedWhenReady);
        return this.index++;
    }
}
```

## Executions

Because services depend on component lifecycles and because of the general asynchronous nature of services, executing actions left and right, it becomes useful to know when an *execution* has finished. At a base level, every constructed service gets a unique execution that finishes when the service no longer has any dependents and gets deconstructed and removed from memory. This base execution can then be *nested* to sub-executions, which can either finish on their own *or* finish whenever their parent finish.

For example, the `asyncConstructor` gets passed a unique execution that finalizes once the service is deemed constructed, which is when the promise returned by the `asyncConstructor` has been resolved. If the service is deconstructed before the `asyncConstructor` finishes, though, the passed execution will also be deemed finished.

To know whether an execution is done, it provides the `done: boolean` value as well as the `onDone(listener)` method.

So what is the practical value of these *executions*? Well, for example, one can attach them to HTTP-requests, which then can be cancelled if the execution finishes before the HTTP-request.

It can also be passed to methods that modify state, telling them that the state should not be modified if the execution is done. Of course, this requires the methods to check the `done` property manually, so it requires special implementations.

You may also choose to develop services that do not care about executions, for the simply reason that executions lead to too much confusion. That is reasonable, of course. Executions should be seen as an extra feature for developers that want something a bit more fine-grained.

```typescript
import { Service, ServiceExecution } from "servido";

class MyService extends Service {
    protected async asyncConstructor(execution: ServiceExecution) {
        execution.onDone(() => {
            console.info("MySevice has been deconstructed!")
        })

        this.deconstructFns.add(() => {
            // called before service execution has finished
            console.info("MySevice is not used anymore!")
        })
    }
}
```

## Service data

An additional and very useful feature of servido are specific methods for retrieving specific data for specific services. This is mostly useful for server side rendering (unless you want to cache data), where data can be transferred from the server to the client and the HTML is returned only when all of the data has been fetched for the rendered components.

```typescript
import servido, { Service, ServiceConfig } from "servido";

interface Product {
    id: number;
    name: string;
}

class ProductService extends Service {
    error?: Error;
    product?: Product;

    constructor(readonly productId: number) {}

    protected get productPromise() Promise<Product> {
        return servido.resolveData(this);
    }

    protected getServiceConfig(): ServiceConfig<Product> {
        return {
            // returns the product if successful and otherwise throws an error
            getData: async (execution) => fetch<Product>("/product/" + this.productId, execution),
            // ensures that the data is only fetched the first time the service is constructed with the product id
            cacheData: true,
            // unless `true`, the service will only be deemed "constructed" once the data has been fetched
            uncriticalData: false,
            // accepts the returned value unless `fetch` throws an error
            handleData: (product) => {
                this.product = product;
            },
            // accepts any error thrown by `fetch`
            handleDataError: (error) => {
                this.error = error;
            },
        };
    }
}
```

## Service context

Service contexts can be provided to a React tree to ensure that separate instances of the used services are constructed. This is mostly useful for server-side rendering, or in some very special situation where you just want separate service instances. Service contexts can be constructed with static params, which can then be used in the tree.

```tsx
import { ServiceContext, ServiceContextProvider } from "servido";

export default function App(props: React.PropsWithChildren<AppProps>) {
    const { language, children } = props;

    return (
        <ServiceContextProvider params={{ language }}>
            {children}
        </ServiceContextProvider>
    );
}

export interface AppProps {
    language: string;
}
```

## Authors

- Ludvig Aldén [@ludvigalden](https://github.com/ludvigalden)

---

[MIT License.](https://github.com/ludvigalden/servido/blob/master/LICENSE)
