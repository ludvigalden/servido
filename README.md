<p align="center">
  <img src="https://user-images.githubusercontent.com/30798446/76152950-bfbed580-60c5-11ea-9f63-86a2a9dca4ed.png" width="192" height="128" alt="Formik.js" />
</p>

<br>

[![Stable Release](https://img.shields.io/npm/v/servido.svg)](https://npm.im/formik)
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
import { Servido } from "servido";

class Auth extends Servido {
    authenticated: boolean;
}

class TodoRepo extends Servido {
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
import { useServido } from "servido";

function CreateTodos() {
    const repo = useServido(TodoRepo);
}
```

Now, when `Todos` is mounted, `TodoRepo` will be constructed only if it has not been constructed already. Same with `Auth`, which `TodoRepo` depends on - if it has already been constructed, it will return the already constructed instance. Once a Servido no longer has any dependents, the instance will be removed from memory.

This is essentially all that Servido is all about - making sure that the instances are constructed and distributed logically. The rest of the documentation is more about smaller features and minor caveats.

## Async constructors

The functionality of some services are by nature asynchronous, for instance an authentication state like below. This can be implemented by extending the `ServidoAsync` class and defining the `constructorAsync` method.

The promise returned by the `constructorAsync` method will also be used to define the special property `ServidoAsync.constructing`. This is an instance of type `ConstructingStatus` which allows for the methods `start`, `stop`, and `use` and exposes the current status by the property `current`.

```tsx
import { ServidoAsync } from "servido";

class Auth extends ServidoAsync {
    authenticated: boolean;

    protected async constructorAsync() {
        this.authenticated = await fetch("/authentictated");
    }
}

class TodosFetcher extends ServidoAsync {
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
    const auth = useServido(Auth);

    if (auth.constructing.use()) {
        return <p>Loading</p>;
    } else if (!auth.authenticated) {
        return <p>No access</p>;
    }

    return <p>Welcome</p>;
}
```

## Arguments

Say we want a Servido used specifically for a value with a certain certain identifier. In the following code, every `<TodoItem />` will access the instance with the same defined `todoId` as the passed component prop. Additionally, if the passed argument to `useServido` changes, a new instance may or may not be constructed.

```tsx
import { ServidoAsync, useServido } from "servido";

class TodoService extends ServidoAsync {
    current: Todo;

    constructor(readonly todoId: number) {
        super();
    }

    protected async constructorAsync() {
        this.current = await fetch("/todos/" + this.todoId);
    }
}

function TodoItem(props: { todoId: number; }) {
    const todo = useServido(TodoService, props.todoId);

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

Additionally, if no argument is passed and there is a currently existing instance of the required Servido that *has* arguments passed, it will use return that instance. On the other hand, if arguments are passed, the required instance will always be constructed with those same arguments.

## Server-side rendering

When using a Servido inside a component, a `ServidoContext` is used to manage the memory of constructed instances. If that has not been provided using the `ServidoContextProvider`, the default global context will be used. For server-side rendering, or any other reason that might make you want to localize such things, you can do it like so:

```tsx
import { ServidoContextProvider, useServido } from "servido";

function App() {
    return (
        <>
            <ServidoContextProvider>
                <A />
            </ServidoContextProvider>

            <B />
        </>
    )
}

function A() {
    const auth = useServido(Auth);
}

function B() {
    const auth = useServido(Auth);
}
```

In the code above, even though `A` and `B` are rendered simultaneously, the instance of `Auth` used by `A` will not be equal to the one used by `B`, because `A` is provided a different context containing the constructed Servido instances.

## Circular requirements

If a number of Servidos depend on each-other, they must extend `ServidoAsync` and define the requirements inside the `constructorAsync` method, like so:

```typescript
import { ServidoAsync } from "servido";

class A extends ServidoAsync {
    b: B;

    constructorAsync() {
        this.b = this.require(B);
    }
}

class B extends ServidoAsync {
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
