import { assert, test } from 'orca/testing'
import { parseStatus } from './status'

test('parses svn status lines', () => {
  const out = 'M       src/a.c\n?       new file.txt\nA  +    b\n M      props\n\nStatus against revision: 5\n'
  assert.deepEqual(parseStatus(out), [
    { status: 'M', path: 'src/a.c' },
    { status: '?', path: 'new file.txt' },
    { status: 'A', path: 'b' },
    { status: 'M', path: 'props' }
  ])
})
