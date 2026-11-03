// `svn status` line: 7 flag columns, a space, then the path. Column 0 is the item status;
// a property-only change (" M") puts it in column 1.
const LINE = /^[ ADMCIRX?!~][ CM][ L][ +][ SX][ KOTB][ C][ C]? ?(.+)$/

export function parseStatus(text: string): { status: string; path: string }[] {
  return text.split(/\r?\n/).flatMap((l) => {
    const m = LINE.exec(l)
    return m ? [{ status: l[0] === ' ' ? l[1] : l[0], path: l.slice(8).trim() }] : []
  })
}
