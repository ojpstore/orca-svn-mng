import { assert, test } from 'orca/testing'
import { countIncoming, parseStatus } from './status'

test('parses svn status lines', () => {
  const out = 'M       src/a.c\n?       new file.txt\nA  +    b\n M      props\n\nStatus against revision: 5\n'
  assert.deepEqual(parseStatus(out), [
    { status: 'M', path: 'src/a.c' },
    { status: '?', path: 'new file.txt' },
    { status: 'A', path: 'b' },
    { status: 'M', path: 'props' }
  ])
})

test('skips temp files ending in .ext$', () => {
  const out = '?       nexacro\\biz\\$Form.xfdl$\n?       a$b.xfdl\nM       cost$\n'
  assert.deepEqual(parseStatus(out), [
    { status: '?', path: 'a$b.xfdl' },
    { status: 'M', path: 'cost$' }
  ])
})

test('counts items newer on the server', () => {
  const out = '        *     1150   src/a.java\nM       *     1150   b.xml\nM             1150   c.xml\n?                    d\nStatus against revision:   1156\n'
  assert.equal(countIncoming(out), 2)
  assert.equal(countIncoming('Status against revision:   1156\n'), 0)
})
