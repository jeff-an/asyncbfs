const AsyncQueue = require('../src/AsyncQueue');

describe('should test sanity:', () => {
    function mockAsync(maxDepth) {
        // Returns a promise that resolves with arg after 3 seconds
        function makePromise(arg) {
            return new Promise(function(resolve, reject) {
                setTimeout(resolve(arg), 1000);
            });
        }
        let $q = new AsyncQueue(maxDepth);
        $q.enqueueAll(
            makePromise,
            [[0], [50], [100]],
            e => e,
            e => [[e + 1]]
        );
        return $q.begin();
    }

    function mockAsyncMaxResults(maxDepth, maxResults) {
        function makePromise(arg) {
            return new Promise(function(resolve, reject) {
                setTimeout(resolve(arg), 1000);
            });
        }
        let $q = new AsyncQueue(maxDepth, maxResults);
        $q.enqueueAll(
            makePromise,
            [[0], [50], [100]],
            e => e,
            e => [[e + 1]]
        );
        return $q.begin();
    }

    it('structure of return data', () => {
        console.log("structure of return data");
        mockAsync(2).then(function(data) {
            console.log(data);
            console.log("\n");
            expect(data.all.length).toEqual(9);
            [0, 1, 2, 50, 51, 52, 100, 101, 102].forEach(e => expect(data.all.includes(e)).toBe(true));
            [0, 1, 2].forEach(e => expect((data.byLayer)[e].length).toEqual(3));
            expect(Object.keys(data).length).toEqual(2);
        });
    });

    it('number of layers', () => {
        console.log("number of layers");
        mockAsync(3).then(function(data) {
            console.log(data);
            console.log("\n");
            expect(data.all.length).toEqual(12);
            [0, 1, 2, 3, 50, 51, 52, 53, 100, 101, 102, 103].forEach(e => expect(data.all.includes(e)).toBe(true));
            [0, 1, 2, 3].forEach(e => expect((data.byLayer)[e].length).toEqual(3));
            expect(Object.keys(data).length).toEqual(2);
        });
    });

    it('max results option', () => {
        console.log("max results");
        mockAsyncMaxResults(3, 10).then(function(data) {
            console.log(data);
            console.log("\n");
            expect(data.all.length).toEqual(10);
            expect(Object.keys(data).length).toEqual(2);
        });
    });

    it('max results with max depth', () => {
        console.log("max results with max depth");
        mockAsyncMaxResults(0, 10).then(function(data) {
            console.log(data);
            console.log("\n");
            expect(data.all.length).toEqual(0);
        });
    });

});
