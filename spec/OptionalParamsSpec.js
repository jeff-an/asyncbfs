const AsyncQueue = require('../src/AsyncQueue');

function mockAsync(configObj) {
    // Returns a promise that resolves with arg after 3 seconds
    function makePromise(arg) {
        return new Promise(function(resolve, reject) {
            setTimeout(resolve(arg), 1000);
        });
    }
    let $q = new AsyncQueue(configObj);
    $q.enqueueAll(
        makePromise,
        [[0]],
        e => e + 1,
        e => [[e]]
    );
    return $q.begin();
}

function mockAsync1(configObj) {
    function makePromise(arg) {
        return new Promise(function(resolve, reject) {
            setTimeout(resolve(arg), 1000);
        });
    }
    let $q = new AsyncQueue(configObj);
    $q.enqueueAll(
        makePromise,
        [[0]],
        e => e,
        e => [[e + 2]]
    );
    return $q.begin();
}

describe('should test optional logging function parameters:', () => {

    var defaultObj = {
        maxDepth: 3
    };

    afterEach(function() {
        defaultObj = {
            maxDepth: 3
        };
        console.log("\n");
    });

    it('map transform data to object', () => {
        console.log('map transform data to object');
        let configObj = Object.assign(defaultObj, {
            collectTransformedData: (e) => {
                let obj = {};
                obj[e] = e - 1;
                return obj;
            }
        });
        mockAsync(configObj).then((data) => {
            console.log(data);
            expect(Object.keys(data).length).toEqual(3);
            expect(Object.keys(data.transformedDataMap).length).toEqual(4); // 3 depth + 1 to start
            [1, 2, 3, 4].forEach(e => expect(data.transformedDataMap[e]).toEqual(parseInt(e) - 1));
        });
    });

    it('map requeue terms to object', () => {
        console.log('map requeue terms to object');
        let configObj = Object.assign(defaultObj, {
            collectRequeueData: (e) => {
                let obj = {};
                obj[e] = e - 2;
                return obj;
            }
        });
        mockAsync1(configObj).then((data) => {
            console.log(data);
            expect(Object.keys(data).length).toEqual(3);
            expect(Object.keys(data.requeueTermsMap).length).toEqual(3); // 3 depth + 1 to start - 1 because the last item is not requeued
            [2, 4, 6].forEach(e => expect(data.requeueTermsMap[e]).toEqual(parseInt(e) - 2));
        });
    });
});
