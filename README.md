
<p align="center">
  <img src="https://user-images.githubusercontent.com/30798446/76160358-d5fe7d00-6129-11ea-977c-fef96bb46a12.png" width="230" height="230" alt="Servido.js" />
</p>

<h3 align="center">
  Versatile services for React &nbsp;⚗️
</h3>

<br>

[![Stable Release](https://img.shields.io/npm/v/servido.svg)](https://npm.im/servido)
[![Blazing Fast](https://badgen.now.sh/badge/speed/blazing%20%F0%9F%94%A5/green)](https://npm.im/servido)
[![gzip size](http://img.badgesize.io/https://unpkg.com/servido@latest/dist/servido.umd.production.min.js?compression=gzip)](https://unpkg.com/servido@latest/dist/servido.umd.production.min.js)
[![license](https://badgen.now.sh/badge/license/MIT)](./LICENSE)

---

React provides great tools for working with the component lifecycle. In some applications, these tools would be sufficient. In large or complex applications, though, where components communicate with each other and use the same state extensively, using the tools provided by React requires you to write a lot of code that might not be very performant or easy to read. These are the very issues *servido* aims to be a solution for.

Everything about servido builds on the idea of services. A service can be used by React components or other services. It can hold state, provide methods for executing actions, be constructed asynchronously or synchronously, use cached data, and essentially whatever you want to do. A service is defined by extending the exported `Service` class, like so:

```typescript
import { Service } from "servido";

export class MyUtilityService extends Service {
    protected index: number = 0;

    increment(): number {
        return this.index++
    }
}
```

## Using services

- Services can be used by React components or other services.
- Instances of services are shared between components or services within the same *instance context*.
- A service is only constructed if there is no already constructed service instance matching the service query.

```typescript
import { Service } from "servido";

import { MyUtilityService } from "./my-utility-service";

export class MyOtherService extends Service {
    protected readonly util: MyUtilityService;

    constructor() {
        super();

        this.util = this.require(MyUtilityService)
    }
}
```

```typescript
import React from "react";
import { useService } from "servido";

import { MyOtherService } from "./my-other-service";
import { MyUtilityService } from "./my-utility-service";

export function MyComponent() {
    const otherService = useService(MyOtherService);
    const utilityService = useService(MyUtilityService);
    // `otherService.util === utilityService`

    return null;
}
```

## Identified services

- If a service accepts arguments, an identifier is generated using the passed arguments when requiring or using a service.
- The arguments can be all types of values.
- If more than one argument or a non-primitive argument is passed, a hash is generated instead, and otherwise a string representation of the primitive value is used.
- If only `undefined` arguments are passed, that is equal to passing no arguments.
- If no arguments are passed, servido will return any instance of the service that has already been constructed, preferring an instance constructed with no arguments, or construct a new instance with no arguments passed to the constructor. That means "no arguments" mean "any arguments, but preferably no arguments".

```typescript
import { Service } from "servido";

import { MyUtilityService } from "./my-utility-service";

export class MyIdentifiedService extends Service {
    constructor(readonly myIdentifier: number) {
        super();
    }
}

export class MyBaseService extends Service {
    protected readonly id: MyIdentifiedService;

    constructor(myIdentifier: number) {
        super();

        this.id = this.require(MyIdentifiedService, myIdentifier);
    }
}
```

```typescript
import React from "react";
import { useService } from "servido";

import { MyIdentifiedService, MyBaseService } from "./my-identified-services";

export function MyIdentifiedComponent() {
    const identifiedServices = {
        1: useService(MyIdentifiedService, 1),
        2: useService(MyIdentifiedService, 2),
    };
    const baseService = useService(MyBaseService, 1)
    // `baseService.id === identifiedServices[1]`

    return null;
}
```

## Asynchronicity

Many services depend on asynchronicity on some level, for example HTTP-requests. Also, there are situations where services might depend on each other, i.e. circular requirements. In these cases, you can use the `asyncConstructor` method, which is called by `servido` when constructing the service.

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

## Service data

An additional and very useful feature of servido are specific methods for retrieving specific data for specific services. This is mostly useful for server side rendering (unless you want to cache data), where data can be transferred from the server to the client and the HTML is returned only when all of the data has been fetched for the rendered components.

```typescript
import servido, { Service, ServiceExecution } from "servido";

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
            getData: async (execution) => (
                fetch<Product>("/product/" + this.productId, execution)
            ),
            // ensures that the data is only fetched the first time the service is constructed with the product id
            cacheData: true,
            // unless `true`, the service will only be deemed "constructed" once the data has been fetched
            uncriticalData: false,
            // handles the returned value unless `getData` throws an error
            handleData: (product) => {
                this.product = product;
            },
            // handles any error thrown by `getData`
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

## Service executions

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
            console.log("MySevice has been deconstructed!")
        })

        this.deconstructFns.add(() => {
        // called before service execution has finished
            console.log("MySevice is not used anymore!")
        })
    }
}
```

## Authors

- Ludvig Aldén [@ludvigalden](https://github.com/ludvigalden)

---

[MIT License.](https://github.com/ludvigalden/servido/blob/master/LICENSE)
