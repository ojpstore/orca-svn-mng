import { atom, Box, Button, Callout, Card, CodeView, Spinner, EmptyState, Row, Stack, Text, Textarea, Checkbox, List, ListItem, Badge, plugin, read, set, update, type PanelContext } from 'orca'

const items = atom<{ status: string; path: string }[]>([])
const picked = atom<string[]>([]) // paths to commit
const message = atom('message', '')
const note = atom<{ tone: 'success' | 'danger'; text: string; show?: boolean } | null>(null)
const diff = atom<string | null>(null)
const busy = atom(false)
const cwd = atom<string | null>(null)
const notWc = atom(false)
/** Lines of the running `svn update`; null when no update is running. */
const progress = atom<string[] | null>(null)

// Every action funnels through here: busy flag, error -> note, then refresh the list.
// `show` puts the returned text in the callout instead of the generic "완료".
async function act(fn: () => Promise<string | void>, show = false): Promise<void> {
  set(busy, true)
  try {
    const text = await fn()
    const ok = text ? { tone: 'success' as const, text, show } : null
    set(note, ok)
    // Success fades after 3 s, unless a newer message replaced it meanwhile.
    if (ok) setTimeout(() => read(note) === ok && set(note, null), 3000)
  } catch (e) {
    set(note, { tone: 'danger', text: (e as Error).message })
  }
  await refresh()
  set(busy, false)
}

async function refresh(): Promise<void> {
  const r = await plugin.request('svn.status')
  set(cwd, r.cwd)
  set(items, r.items)
  set(notWc, !!r.notWc)
  update(picked, (p) => p.filter((x) => r.items.some((i) => i.path === x)))
  if (r.error) set(note, { tone: 'danger', text: r.error })
}

export function setup(ctx: PanelContext): void {
  ctx.subscriptions.push(plugin.on('svn.progress', ({ line }) => update(progress, (p) => (p ? [...p.slice(-7), line] : p))))
  ctx.subscriptions.push(plugin.on('svn.changed', () => void refresh()))
  void refresh()
}

const toggle = (path: string, on: boolean) =>
  update(picked, (p) => (on ? [...p, path] : p.filter((x) => x !== path)))

export default function Panel() {
  const list = read(items)
  const sel = read(picked)
  const msg = read(message)
  const n = read(note)
  const d = read(diff)
  const b = read(busy)
  const nw = read(notWc) // not an svn working copy: lock the controls
  return (
    <Stack gap="md">
      <Row justify="between">
        <Text muted size="xs" truncate>{read(cwd) ?? 'no workspace'}</Text>
        <Row gap="xs">
          <Button size="sm" icon="refresh" disabled={b} onPress={() => act(async () => {
            if (read(notWc)) return
            const { count } = await plugin.request('svn.incoming', undefined, { timeoutMs: 120000 })
            return count ? `업데이트 항목 ${count}건이 있습니다` : '업데이트 항목이 없습니다'
          }, true)}>Refresh</Button>
          <Button size="sm" icon="download" disabled={b || nw} onPress={() => act(async () => {
            set(progress, [])
            try {
              return (await plugin.request('svn.update', undefined, { timeoutMs: 120000 })).text
            } finally {
              set(progress, null)
            }
          })}>Update</Button>
        </Row>
      </Row>
      {read(notWc) && <Callout tone="warning" title="SVN 관리 폴더가 아닙니다"><Text size="xs">이 폴더는 svn 작업 사본(working copy)이 아닙니다.</Text></Callout>}
      {read(progress) && (
        <Card title="Updating...">
          <Stack gap="xs">
            <Spinner label="svn update" />
            {read(progress)!.map((l, i) => <Text key={i} size="xs" muted truncate>{l}</Text>)}
          </Stack>
        </Card>
      )}
      {n && (n.tone === 'success'
        ? <Callout tone="success" title={n.show ? n.text : '완료'} />
        : <Callout tone="danger" title="오류"><Text size="xs">{n.text}</Text></Callout>)}
      {read(notWc) ? null : list.length === 0 ? (
        <EmptyState title="No changes" icon="check" />
      ) : (
        <Stack gap="xs">
          <Checkbox
            label={`전체 선택 (${sel.length}/${list.length})`}
            checked={sel.length === list.length}
            onChange={(on) => set(picked, on ? list.map((i) => i.path) : [])}
          />
          {/* Only the list scrolls, so the commit message and button stay put. */}
          <Box maxHeight="lg" scroll="y" gap="xs">
          {list.map((i) => (
            <Row key={i.path} gap="xs" justify="between">
              <Checkbox label={i.path} checked={sel.includes(i.path)} onChange={(on) => toggle(i.path, on)} />
              <Row gap="xs">
                <Badge tone={i.status === '?' ? 'warning' : i.status === 'C' ? 'danger' : 'accent'}>{i.status}</Badge>
                <Button size="xs" variant="ghost" onPress={async () => set(diff, (await plugin.request('svn.diff', { path: i.path })).text)}>Diff</Button>
              </Row>
            </Row>
          ))}
          </Box>
        </Stack>
      )}
      {!read(notWc) && d !== null && <CodeView code={d || '(no diff)'} language="diff" maxHeight="md" />}
      <Textarea label="Commit message" rows={2} disabled={nw} value={msg} onChange={(v) => set(message, v)} />
      <Button
        disabled={b || nw || !msg.trim() || sel.length === 0}
        onPress={() => act(async () => {
          const r = await plugin.request('svn.commit', { message: msg.trim(), paths: sel })
          set(message, '')
          set(diff, null)
          return r.text
        })}
      >
        Commit {sel.length} file(s)
      </Button>
    </Stack>
  )
}
