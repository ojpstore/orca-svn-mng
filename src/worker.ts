// Runs svn in the focused workspace's folder. Panels can't spawn processes, so the worker does.
import { execFile, spawn } from 'node:child_process'
import type { OrcaWorkerApi } from 'orca/worker'
import { parseStatus } from './status'

function svn(cwd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) =>
    execFile('svn', args, { cwd, timeout: 110_000, maxBuffer: 8 << 20, windowsHide: true }, (err, out, errText) =>
      err ? reject(new Error((errText || err.message).trim()))
      // svn reports "not a working copy" as a warning with exit 0 and empty stdout.
      : !out && /W\d{6}|E\d{6}/.test(errText) ? reject(new Error(errText.trim()))
      : resolve(out)
    )
  )
}

export default function activate(orca: OrcaWorkerApi): void {
  // Focused workspace -> folder path (readContext has no path, so match it in workspace.list).
  async function cwd(): Promise<string | null> {
    const ctx = await orca.host.call('workspace.readContext')
    if (!ctx) return null
    const { workspaces } = await orca.host.call('workspace.list')
    return workspaces.find((w) => w.name === ctx.displayName && (w.branch ?? null) === (ctx.branch || null))?.path ?? null
  }
  async function run(args: string[]): Promise<string> {
    const dir = await cwd()
    if (!dir) throw new Error('No focused workspace')
    return svn(dir, args)
  }

  orca.panels.handle('svn.status', async () => {
    const dir = await cwd()
    if (!dir) return { cwd: null, items: [], error: 'No focused workspace' }
    try {
      return { cwd: dir, items: parseStatus(await svn(dir, ['status'])) }
    } catch (e) {
      return { cwd: dir, items: [], error: (e as Error).message }
    }
  })
  // Streams svn's output to the panel line by line so it can show progress.
  orca.panels.handle('svn.update', async () => {
    const dir = await cwd()
    if (!dir) throw new Error('No focused workspace')
    return new Promise<{ text: string }>((resolve, reject) => {
      const p = spawn('svn', ['update', '--non-interactive'], { cwd: dir, windowsHide: true })
      let all = ''
      let err = ''
      let tail = ''
      p.stdout.on('data', (d: Buffer) => {
        all += d
        const lines = (tail + d).split(/\r?\n/)
        tail = lines.pop() ?? ''
        for (const line of lines) if (line.trim()) orca.panels.post('svn.progress', { line })
      })
      p.stderr.on('data', (d: Buffer) => (err += d))
      p.on('error', reject)
      p.on('close', (code) =>
        code === 0 ? resolve({ text: all.trim() }) : reject(new Error(err.trim() || `svn exited ${code}`))
      )
    })
  })
  orca.panels.handle('svn.commit', async ({ message, paths }) => {
    // '--' ends options so a path can't be read as a flag; execFile means no shell.
    // Unversioned ('?') files the user ticked must be added first or commit refuses them.
    const fresh = parseStatus(await run(['status', '--', ...paths])).filter((i) => i.status === '?')
    if (fresh.length) await run(['add', '--parents', '--', ...fresh.map((i) => i.path)])
    return { text: (await run(['commit', '--non-interactive', '-m', message, '--', ...paths])).trim() }
  })
  orca.panels.handle('svn.diff', async ({ path }) => ({ text: await run(['diff', '--', path]) }))
}
