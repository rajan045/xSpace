// Scanner self-checks:
//  1. hashFile() vs a buffered reference hash, at the 1 MB chunk boundary where
//     the reused read buffer could leak stale bytes.
//  2. diskBytes() reports ALLOCATED blocks, not apparent size, so a sparse file
//     (Docker.raw claims 245 GB, occupies 6 GB) can't inflate "recoverable".
// Run: npm run test:scanners   (builds electron TS first)
import fs from 'fs'
import os from 'os'
import path from 'path'
import crypto from 'crypto'
import assert from 'assert'
import { execFileSync } from 'child_process'
import { hashFile } from '../dist-electron/electron/scanners/duplicates.js'
import { diskBytes } from '../dist-electron/electron/scanners/utils.js'

const reference = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')
const MB = 1024 * 1024
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xspace-hash-'))

try {
  const cases = {
    empty: Buffer.alloc(0),
    'one-byte': Buffer.from([0x00]),
    'exactly-1MB': crypto.randomBytes(MB),
    'exactly-2MB': crypto.randomBytes(2 * MB),
    '1MB-plus-1': crypto.randomBytes(MB + 1),
    '3MB-and-a-bit': crypto.randomBytes(3 * MB + 7777),
  }
  for (const [name, data] of Object.entries(cases)) {
    const p = path.join(dir, name)
    fs.writeFileSync(p, data)
    assert.strictEqual(hashFile(p), reference(p), `hash mismatch on ${name}`)
    console.log(`ok  ${name}`)
  }

  const a = path.join(dir, 'copy-a')
  const b = path.join(dir, 'copy-b')
  const payload = crypto.randomBytes(2 * MB + 13)
  fs.writeFileSync(a, payload)
  fs.writeFileSync(b, payload)
  assert.strictEqual(hashFile(a), hashFile(b), 'identical files must hash equal')
  console.log('ok  identical files hash equal')

  fs.writeFileSync(b, Buffer.concat([payload.subarray(0, payload.length - 1), Buffer.from([payload.at(-1) ^ 1])]))
  assert.notStrictEqual(hashFile(a), hashFile(b), 'last-byte difference must change the hash')
  console.log('ok  one-byte difference detected')

  assert.strictEqual(hashFile(path.join(dir, 'nope')), null, 'unreadable file must return null')
  console.log('ok  missing file returns null')

  // --- diskBytes: sparse files must report allocated blocks, not apparent size ---
  const sparse = path.join(dir, 'sparse.img')
  // 1 GB apparent, one byte written at the end -> a few KB actually allocated
  const fd = fs.openSync(sparse, 'w')
  fs.ftruncateSync(fd, 1024 * MB)
  fs.writeSync(fd, Buffer.from([1]), 0, 1, 1024 * MB - 1)
  fs.closeSync(fd)

  const st = fs.statSync(sparse)
  const reported = diskBytes(st)
  const duBytes = parseInt(execFileSync('du', ['-k', sparse], { encoding: 'utf8' }).split('\t')[0], 10) * 1024

  assert.strictEqual(st.size, 1024 * MB, 'apparent size should be 1 GB')
  assert.ok(reported < 64 * MB, `sparse file must not report apparent size (got ${reported})`)
  assert.ok(Math.abs(reported - duBytes) <= 4096, `diskBytes ${reported} should match du ${duBytes}`)
  console.log(`ok  sparse file: apparent ${(st.size / 1e6).toFixed(0)}MB -> diskBytes ${(reported / 1e3).toFixed(0)}KB (du agrees)`)

  // a normal file's allocated size should be at least its content
  const dense = path.join(dir, 'dense.bin')
  fs.writeFileSync(dense, crypto.randomBytes(3 * MB))
  assert.ok(diskBytes(fs.statSync(dense)) >= 3 * MB, 'dense file must not under-report')
  console.log('ok  dense file reports >= content size')

  console.log('\nALL PASS')
} finally {
  fs.rmSync(dir, { recursive: true, force: true })
}
