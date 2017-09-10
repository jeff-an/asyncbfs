/*jshint node: true */
"use strict";

/*
* Asynchronous queue implementation where elements are only removed after their callbacks return,
* allowing for an ordering roughly resembling BFS
*/
function AsyncQueue(...args) {

    /** Variables that are the same for all initialization types (regardless of user arguments) **/
    let $ = this; // shorthand
    $.queue = []; // Elements are objects { layer: 0, promise: ... callback: fn requeue: fn} that represent unresolved promises
    $.processed = 0;
    $.all = [];
    $.byLayer = {};
    $.transformedDataMap = {};
    $.requeueTermsMap = {};

    /** Custom user defined variables **/
    $.maxDepth = Infinity;
    $.maxResults = Infinity;
    $.collectTransformedData = null;
    $.collectRequeueData = null;
    $.shortCircuit = null;

    /** Local utility functions for initialization **/
    let possibleArgs = {
        collectTransformedData: 0,
        collectRequeueData: 0,
        maxDepth: 0,
        maxResults: 0,
        shortCircuit: 0,
    };

    let checkArgument = function(arg) {
        if (typeof possibleArgs[arg] !== undefined) {
            delete possibleArgs[arg];
            return true;
        }
        throw new Error(`Argument ${arg} was unexpected or otherwise already defined. Please check the config object you are passing.`);
    };

    if (arguments.length === 0) {
        throw new Error('No arguments provided for Async Queue constructor. This will result in an infinite loop!');
    } else {
        switch (args.length) {
            case 1:
                if (typeof args[0] === 'object') {
                    let obj = args[0];
                    // Assume we were passed a config object
                    Object.keys(obj).forEach(arg => {
                        checkArgument(arg);
                        $[arg] = obj[arg];
                    });
                } else if (typeof args[0] === 'number') {
                    $.maxDepth = args[0];
                } else {
                    throw new Error(`Received invalid argument of type ${typeof args[0]}. Please check the config object you are passing.`);
                }
                break;
            case 2:
                if (typeof args[0] === 'number' && typeof args[1] === 'number') {
                    [$.maxDepth, $.maxResults] = [args[0], args[1]];
                } else {
                    throw new Error(`AsyncQueue constructor expects one number, two numbers or a config object.
                        Instead received type ${typeof args[0]} and type ${typeof args[1]}.
                        `);
                }
                break;
            default:
                throw new Error(`Received more than two arguments to AsyncQueue constructor. Read the documentation!`);
        }
    }

    // Check the type of functions provided (if they exist)
    if (!($.collectTransformedData === null || typeof $.collectTransformedData === 'function')) {
        throw (new Error("Expected a function but found a non-function argument provided in the configuration object."));
    } else if (!($.collectRequeueData === null || typeof $.collectRequeueData === 'function')) {
        throw (new Error("Expected a function but found a non-function argument provided in the configuration object."));
    } else if (!($.shortCircuit === null || typeof $.shortCircuit === 'function')) {
        throw (new Error("Expected a function but found a non-function argument provided in the configuration object."));
    }

    /** Core 'private' functions **/

    let addInitial = function(depth, promise, callback, requeue, func, args) {
        $.queue.push({
            layer: depth,
            promise: promise,
            callback: callback,
            requeue: requeue,
            func: func,
            previous: args,
        });
        $.processed = $.processed + 1;
    };

    let resolveAction = (resolve) => {
        let returnItems = ['all', 'byLayer', 'requeueTermsMap', 'transformedDataMap'];
        let returnObj = {};
        returnItems.forEach(term => {
            if (typeof $[term] !== "undefined" && $[term] !== null && Object.keys($[term]).length > 0) {
                returnObj[term] = $[term];
            }
        });
        return resolve(returnObj);
    };

    let bfs = function(list, resolve) {
        if (typeof list !== 'object') {
            throw new Error("List of terms to be queued is not an array.");
        } else if (list == null || list.length == 0) {
            return;
        }

        // Add promises to queue and send all
        list.forEach(element => {
            let layer = element.layer;
            let previous = element.previous;
            let toRequeue = [];
            $.queue.push(element);
            element.promise().then((data) => {
                // Use Promise.resolve in case callback returns a promise
                Promise.resolve(element.callback(data)).then(function(transformedData) {

                    // Update transformed data map
                    if ($.collectTransformedData !== null) {
                        try {
                            Object.assign($.transformedDataMap, $.collectTransformedData(transformedData, previous));
                        } catch (err) {
                            console.error("Failed updating the transformed data map using provided function. Make sure that collectTransformedData returns a valid object.");
                        }
                    }

                    // Attempt to define a __previous property on the object
                    if (typeof transformedData === 'object' && typeof transformedData._previous === 'undefined') {
                        try {
                            Object.defineProperty(transformedData, '__previous', {
                                enumerable: false,
                                configurable: true,
                                writable: true,
                                value: previous
                            });
                        } catch (err) {
                            // Ignore - object may not be writeable
                        }
                    }

                    // Update "all" array
                    $.all.push(transformedData);

                    // Update layer object
                    if ($.byLayer[layer] == null) {
                        $.byLayer[layer] = [transformedData];
                    } else {
                        $.byLayer[layer].push(transformedData);
                    }

                    // Iteratively enqueue more items according to callbacks
                    if (layer < $.maxDepth) {
                        // Use Promise.resolve in case requeue returns a promise
                        Promise.resolve(element.requeue(transformedData)).then(function(requeueTerms) {

                            // Update requeue terms data map
                            if ($.collectRequeueData !== null) {
                                try {
                                    Object.assign($.requeueTermsMap, $.collectRequeueData(requeueTerms, transformedData, previous));
                                } catch (err) {
                                    console.error("Failed updating the transformed data map using provided function. Make sure that collectRequeueData returns a valid object.");
                                }
                            }

                            // Apply short circuiting if applicable
                            if (typeof $.shortCircuit === 'function' && $.shortCircuit(transformedData, requeueTerms)) {
                                return resolveAction(resolve);
                            }

                            // Support destructuring for the requeue terms
                            if (requeueTerms == null || typeof requeueTerms === 'object' && requeueTerms.length === 0) {
                                requeueTerms = [];
                            }
                            if (typeof requeueTerms !== 'object') {
                                requeueTerms = [requeueTerms];
                            }

                            for (let term of requeueTerms) {
                                if ($.processed >= $.maxResults) {
                                    break;
                                } else if (typeof term !== 'object') {
                                    term = [term];
                                }
                                let promise = function() { // jshint ignore:line
                                    return element.func(...term);
                                };
                                toRequeue.push({
                                    layer: layer + 1,
                                    promise: promise,
                                    callback: element.callback,
                                    requeue: element.requeue,
                                    func: element.func,
                                    previous: term,
                                });
                                $.processed = $.processed + 1;
                            }

                            // Remove the element we started with since its work is finished
                            let index = $.queue.indexOf(element);
                            $.queue = $.queue.slice(0, index).concat($.queue.slice(index + 1));

                            // Return if empty or recurse
                            if ($.queue.length === 0 && toRequeue.length === 0) {
                                return resolveAction(resolve);
                            }

                            // Recurse with the new argument list
                            bfs(toRequeue, resolve);

                        }, function(rejection) {
                            console.error("Async Queue Error: Requeue promise was rejeted with reason " + rejection);
                        });
                    } else {
                        let index = $.queue.indexOf(element);
                        $.queue = $.queue.slice(0, index).concat($.queue.slice(index + 1));

                        // Return if empty or recurse
                        if ($.queue.length === 0 && toRequeue.length === 0) {
                            return resolveAction(resolve);
                        }

                    }
                }, function(rejection) {
                    console.error("Async Queue Error: Callback promise was rejected with reason " + rejection);
                });
            });
        });
    };

    /** Exposed public functions **/

    $.begin = function() {
        if ($.maxResults <= 0 || $.maxDepth <= 0) {
            console.warn("Either a max results or max depth value of 0 was provided to AsyncQueue, meaning no results will be returned.");
            return new Promise((resolve, reject) => resolve({
                all: [],
                byLayer: {}
            }));
        }
        let newQueue = $.queue;
        $.queue = [];
        return new Promise((resolve, reject) => {
            bfs(newQueue, resolve);
        });
    };

    $.enqueue = function(func, args, callback, requeue) {
        if (typeof func !== 'function') {
            throw (new Error("Invalid argument passed to enqueue. Func must be a function returning a promise."));
        } else if (typeof args !== 'object') {
            throw (new Error("Invalid argument passed to enqueue. Args must be an array of arguments."));
        } else if ($.processed >= $.maxResults) {
            throw (new Error(`Number of objects enqueued exceeds the set maximium results. Limit was set to ${$.maxResults}.`));
        }
        let layer = 0;
        let promise = function() {
            return func(...args);
        };
        try {
            addInitial(layer, promise, callback, requeue, func, args);
        } catch(err) {
            console.error(err);
        }
    };

    $.enqueueAll = function(func, args, callback, requeue) {
        args.forEach(e => this.enqueue(func, e, callback, requeue));
    };
}

var exports = module.exports = AsyncQueue;
