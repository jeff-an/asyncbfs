# asyncbfs
Configurable npm module for asynchronous breadth-first-search action. Supports asynchronous callbacks and custom data transformations on individual BFS results.

## Installation

`npm install --save asyncbfs`

## What It Does

### Overview

AsyncBFS allows you to automatically "recurse" on resolved promises, using the value of the resolved promise as input for the next promise. This recursion will continue until the maximum depth or maximum number of resolved promises is reached. AsyncBFS also supports a custom "short-circuiting" function that will stop the recursion at a specific point.

A major aspect of AsyncBFS is that **you** control what to requeue. When promises are resolved, the functions you provide are called to determine whether to recurse and which promises to fire next. In that respect, AsyncBFS follows the [inversion of control](https://en.wikipedia.org/wiki/Inversion_of_control) principle.

### Use Case

This module is useful for cases where you want to fire additional promises based on the results of previous promises. For instance, on a social media network you might want to find out who is within n steps of a certain user (where a single step is a friend relationship).

As a more concrete example, I personally used AsyncBFS for graph data generation in my concept mapping site [ideamap.ca](http://ideamap.ca).

## API

### Basic setup

#### Initialization

The constructor for this module is AsyncQueue. It can accept different configuration parameters. At the very least, you must supply a **single number argument** corresponding to the maximum depth:

`var queue = new AsyncQueue(2);`

You can also supply **two number arguments** indicating both maximum depth and maximum results (maximum number of resolved promises):

`var queue = new AsyncQueue(2, 10);`
   <br/>

#### Usage

After initialization, you can enqueue an arbitrary number of promises before "firing" all of them. Two methods are exposed for this:

`enqueue(function, arguments, transform, requeue)` :

  - **function** : the function that will generate the promise when called with `arguments`
  
  - **arguments** : an **array** containing the arguments that will be passed to `function` (i.e. AsyncQueue will execute `function(...arguments)`)
  
  - **transform** : a callback that will be called on all resolved promises. The return value of `transform` is added to the final object that is returned. Pass (e) => e if you want to write the resolved promise unaltered to the final return object. This function **can be asynchronous**.
  
  - **requeue**: a callback that will be called on the resolved value of `transform`. Requeue should return an **array of arrays**, where each inner array represents the arguments that `function` should be called again on.
   <br/>
   
`enqueueAll(function, arguments, transform, requeue)` :

Same as enqueue except arguments is an **array of array** representing multiple sets of arguments to be passed to `function`. `enqueue(function, set, transform, requeue)` will be called on each set. This is just a convenience function.
  <br/>
  

After enqueuing the desired promises, start the BFS action by calling begin:

```
// Assume we defined var queue = new AsyncQueue(2) and enqueued some promises
...

queue.begin() // returns a promise that will resolve when depth of 2 is reached
```

By default, begin resolves with an object with two keys, all and byLayer. All contains the value of all resolved promises after being transformed by `transform`. ByLayer is just another object that separates these values by layer.

## Basic Example

```
// Fn to simulate asynchronous action that resolves with "arg" after 3 seconds
function async(arg) {
  return new Promise((resolve, reject) => {
    setTimeout(resolve(arg), 3000);
    });
}

var queue = new AsyncQueue(3, 10); // Max depth of 2

queue.enqueueAll(
  async,
  [[0], [50], [100]],
  e => e, // Do not transform the resolved values
  e => [[e + 1]] // Requeue the resolved value + 1
);

queue.begin().then((data) => console.log(data));

// Output:

{
  all: [0, 50, 100, 1, 51, 101, 2, 52, 102],
  byLayer: {
      0: [0, 50, 100],
      1: [1, 51, 101],
      2: [2, 52, 102]
  }
}

```

### Advanced setup

To access the more advanced options, you can supply a single config object to `AsyncQueue` that accepts the following keys:

  - maxDepth: maximum depth of recursion
  
  - maxResults: maximum number of results
  
  - collectTransformedData: a function that allows you to customize what to write to the final return object. If supplied, the final return object will have an additional key called `transformedDataMap`, which is an object. During the BFS action, `collectTransformedData` is called with each return value of `transform` (the third function given to enqueue) and should **return an object**. The keys of the object returned by `collectTransformedData` will be added to `transformedDataMap`.
  
  - collectRequeue: a function that allows you to customize what to write to the final return object. If supplied, the final return object will have an additional key called `requeueTermsMap`, which is an object. During the BFS action, `collectRequeueData` is called with each return value of `requeue` (the fourth function given to enqueue) and should **return an object**. The keys of the object returned by `collectRequeueData` will be added to `requeueTermsMap`.
  
- shortCircuit: a function called after each resolved promise. It is called with two arguments: transformedData (the return value of `transform`) and requeueTerms (the return value of `requeue'). If shortCircuit returns true, the queue will stop receiving, resolving, and requeueing further promises and return immediately with the values accumulated thusfar.

### Advanced Example

In this example we will use `collectTransformedData` to reverse the operation done by `transform` and write the original resolved values to `transformedDataMap`. Note that this does not affect what terms are requeued.

```
// Fn to simulate asynchronous action that resolves with "arg" after 3 seconds
function async(arg) {
  return new Promise((resolve, reject) => {
    setTimeout(resolve(arg), 3000);
    });
}

var config = {
  maxDepth: 3,
  collectTransformedData: (e) => {
    [e]: e - 1; // ES6 computed properties feature
  }
};

var queue = new AsyncQueue(config);
queue.enqueueAll(
  async,
  [[0]],
  e => e + 1,
  e => [[e]]
);

queue.begin().then((data) => console.log(data));

// Output:
{
  all: [1, 2, 3, 4], // +1-ed by transform
  byLayer: {
    0: [1],
    1: [2],
    2: [3],
    3: [4],
  },
  transformedDataMap: { // Maps the +1-ed values to the original values
    1: 0,
    2: 1,
    3: 2,
    4: 3
  }
}

```
