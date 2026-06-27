import { exec, spawn } from 'child_process'
import { promisify } from 'util'

export const execAsync = promisify(exec)

/** Run a shell command async — never blocks the main thread */
export async function run(cmd: string, timeoutMs = 30000): Promise<string> {
  try {
    const { stdout } = await execAsync(cmd, { timeout: timeoutMs })
    return stdout.trim()
  } catch {
    return ''
  }
}

/** Get directory size in bytes using du -sk, async */
export async function getDirSizeAsync(dirPath: string, timeoutMs = 60000): Promise<number> {
  const out = await run(`du -sk "${dirPath}" 2>/dev/null | awk '{print $1}'`, timeoutMs)
  return parseInt(out, 10) * 1024 || 0
}

/** Stream output of a long-running find command, resolving once it ends or times out */
export function streamFind(args: string[], timeoutMs = 90000): Promise<string[]> {
  return new Promise(resolve => {
    const lines: string[] = []
    const proc = spawn('find', args, { timeout: timeoutMs })

    let buf = ''
    proc.stdout.on('data', (chunk: Buffer) => {
      buf += chunk.toString()
      const parts = buf.split('\n')
      buf = parts.pop() ?? ''
      lines.push(...parts.filter(Boolean))
      // Stop early if we have enough
      if (lines.length >= 200) {
        proc.kill()
        resolve(lines.slice(0, 200))
      }
    })

    proc.on('close', () => {
      if (buf) lines.push(buf)
      resolve(lines)
    })

    proc.on('error', () => resolve(lines))
  })
}
