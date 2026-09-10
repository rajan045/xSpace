#!/usr/bin/env node
/* Guards the two-color rule: #0B1120 (dark blue) + #FFFFFF, everything else is
   one of those at some opacity via CSS vars. Fails if a raw hex color sneaks back in. */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

const ROOTS = ['src', 'electron']
const EXTS = new Set(['.ts', '.tsx', '.css'])
const ALLOWED = new Set(['#0b1120', '#ffffff', '#fff'])
const HEX = /#[0-9a-fA-F]{3,8}\b/g

function walk(dir) {
  return readdirSync(dir).flatMap(name => {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) return walk(p)
    return EXTS.has(extname(p)) ? [p] : []
  })
}

const offenders = []
for (const root of ROOTS) {
  for (const file of walk(root)) {
    readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
      if (line.trim().startsWith('*') || line.trim().startsWith('//')) return
      for (const hex of line.match(HEX) || []) {
        if (!ALLOWED.has(hex.toLowerCase())) offenders.push(`${file}:${i + 1}  ${hex}`)
      }
    })
  }
}

if (offenders.length) {
  console.error('Two-color palette broken — raw colors found:\n' + offenders.join('\n'))
  process.exit(1)
}
console.log('Palette OK — only #0B1120 / #FFFFFF plus CSS-var tones.')
