#!/usr/bin/env node
/* Scan results are reused between page visits — if this cache is wrong the app
   either re-walks the disk every time (slow) or shows stale sizes after a delete. */
import assert from 'node:assert/strict'
import { cached, invalidateScans } from '../dist-electron/electron/scanners/scanCache.js'

let runs = 0
const produce = async () => { runs++; return runs }

// hit: second call inside the TTL reuses the first result
assert.equal(await cached('k', 60000, false, produce), 1)
assert.equal(await cached('k', 60000, false, produce), 1)
assert.equal(runs, 1)

// force: Refresh always re-walks
assert.equal(await cached('k', 60000, true, produce), 2)
assert.equal(runs, 2)

// expiry: past the TTL it re-walks on its own
assert.equal(await cached('k', 0, false, produce), 3)

// in-flight: two callers during one scan share it instead of starting a second
runs = 0
let release
const slow = () => new Promise(res => { runs++; release = () => res('done') })
const a = cached('slow', 60000, false, slow)
const b = cached('slow', 60000, false, slow)
release()
assert.deepEqual(await Promise.all([a, b]), ['done', 'done'])
assert.equal(runs, 1)

// invalidate: sizes must not survive a delete
runs = 0
await cached('k2', 60000, false, produce)
invalidateScans()
await cached('k2', 60000, false, produce)
assert.equal(runs, 2)

console.log('scan cache OK')
