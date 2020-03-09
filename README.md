
<p align="center">
  <img src="https://user-images.githubusercontent.com/30798446/76160358-d5fe7d00-6129-11ea-977c-fef96bb46a12.png" width="230" height="230" alt="Servido.js" />
</p>

<h3 align="center">
  Clear and logically sound services in React. &nbsp;⚗️
</h3>

<br>

[![Stable Release](https://img.shields.io/npm/v/servido.svg)](https://npm.im/servido)
[![Blazing Fast](https://badgen.now.sh/badge/speed/blazing%20%F0%9F%94%A5/green)](https://npm.im/servido)
[![gzip size](http://img.badgesize.io/https://unpkg.com/servido@latest/dist/servido.umd.production.min.js?compression=gzip)](https://unpkg.com/servido@latest/dist/servido.umd.production.min.js)
[![license](https://badgen.now.sh/badge/license/MIT)](./LICENSE)

---

In any real-world React application, there is a need for sharing state and actions between components. For this purpose, people commonly use Redux, MobX or plain contexts.

Servido proposes a new way to structure these kinds of things, which was built with the following ideas in mind:

- Shared state can be seperated into clearly defined parts (DRY)
- Some parts of the state may depend on other parts
- A component may only need a part of the state

For instance, let's say we have an authentication state as well as a state for managing the creation of to-dos:

```typescript
import { Service } from "servido";

class Auth extends Service {
    authenticated: boolean;
}

class TodoRepo extends Service {
    auth: Auth;

    constructor() {
        super();

        this.auth = this.require(Auth);
    }

    create(todo: Todo) {
        if (!this.auth.authenticated) {
            throw
        }
    }
}
```

These can then be used inside a React component:

```typescript
import { useService } from "servido";

function CreateTodos() {
    const repo = useService(TodoRepo);
}
```

Now, when `Todos` is mounted, `TodoRepo` will be constructed only if it has not been constructed already. Same with `Auth`, which `TodoRepo` depends on - if it has already been constructed, it will return the already constructed instance. Once a service no longer has any dependents, the instance will be removed from memory.

This is essentially all that Servido is all about - making sure that the instances are constructed and distributed logically. The rest of the documentation is more about smaller features and minor caveats.

## Async constructors

The functionality of some services are by nature asynchronous, for instance an authentication state like below. This can be implemented by extending the `ServiceAsync` class and defining the `constructorAsync` method.

The promise returned by the `constructorAsync` method will be assigned to the instance in order to handle the `resolveServices` and `constructedServices` utility.

```tsx
import { ServiceAsync } from "servido";

class Auth extends ServiceAsync {
    authenticated: boolean;

    protected async constructorAsync() {
        this.authenticated = await fetch("/authentictated");
    }
}

class TodosFetcher extends ServiceAsync {
    auth: Auth;

    todos: Todo[];

    constructor() {
        super();

        this.auth = this.require(Auth);
    }

    protected async constructorAsync() {
        await this.auth.constructing.onDone();

        this.todos = await fetch("/todos");
    }
}


function App() {
    const auth = useService(Auth);

    if (auth.constructing.use()) {
        return <p>Loading</p>;
    } else if (!auth.authenticated) {
        return <p>No access</p>;
    }

    return <p>Welcome</p>;
}
```

## Arguments

Say we want a service used specifically for a value with a certain certain identifier. In the following code, every `<TodoItem />` will access the instance with the same defined `todoId` as the passed component prop. Additionally, if the passed argument to `useService` changes, a new instance may or may not be constructed.

```tsx
import { ServiceAsync, useService } from "servido";

class TodoService extends ServiceAsync {
    current: Todo;

    constructor(readonly todoId: number) {
        super();
    }

    protected async constructorAsync() {
        this.current = await fetch("/todos/" + this.todoId);
    }
}

function TodoItem(props: { todoId: number; }) {
    const todo = useService(TodoService, props.todoId);

    if (todo.constructing.use()) {
        return <p>Loading</p>
    }

    if (!todo.current) {
        return <p>None found</p>
    }

     return <p>{todo.current.name}</p>
}
```

To be more specific, the arguments generate an identifier which is used to check if arguments are equal. If only one argument is passed, that will serve as the identifier (and be used as a strict equality check), but if more than one a string will be generated using the string constructor. For this reason, do not use objects as arguments.

Additionally, if no argument is passed and there is a currently existing instance of the required service that *has* arguments passed, it will use return that instance. On the other hand, if arguments are passed, the required instance will always be constructed with those same arguments.

## Server-side rendering

When using a service inside a component, a `ServiceContext` is used to manage the memory of constructed instances. If that has not been provided using the `ServiceContextProvider`, the default global context will be used. For server-side rendering, or any other reason that might make you want to localize such things, you can do it like so:

```tsx
import { ServiceContextProvider, useService } from "servido";

function App() {
    return (
        <>
            <ServiceContextProvider>
                <A />
            </ServiceContextProvider>

            <B />
        </>
    )
}

function A() {
    const auth = useService(Auth);
}

function B() {
    const auth = useService(Auth);
}
```

In the code above, even though `A` and `B` are rendered simultaneously, the instance of `Auth` used by `A` will not be equal to the one used by `B`, because `A` is provided a different context containing the instances of the constructed services.

## Circular requirements

If a number of services depend on each-other, they must extend `ServiceAsync` and define the requirements inside the `constructorAsync` method, like so:

```typescript
import { ServiceAsync } from "servido";

class A extends ServiceAsync {
    b: B;

    constructorAsync() {
        this.b = this.require(B);
    }
}

class B extends ServiceAsync {
    a: A;

    constructorAsync() {
        this.a = this.require(A);
    }
}
```

## Authors

- Ludvig Aldén [@ludvigalden](https://github.com/ludvigalden)

---

[MIT License.](https://github.com/ludvigalden/servido/blob/master/LICENSE)
