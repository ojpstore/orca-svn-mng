// The panel <-> worker contract: src/panel.tsx and src/worker.ts both read it.
export {}

declare module 'orca' {
  interface PluginRequests {
    /** `svn status` of the focused workspace. */
    'svn.status': { output: { cwd: string | null; items: { status: string; path: string }[]; error?: string; notWc?: boolean } }
    /** `svn update`; output is svn's own text. */
    'svn.update': { output: { text: string } }
    /** `svn commit -m` for the given paths (relative to the workspace). */
    'svn.commit': { input: { message: string; paths: string[] }; output: { text: string } }
    /** `svn diff` of one path. */
    'svn.diff': { input: { path: string }; output: { text: string } }
  }
  interface PluginPanelEvents {
    /** One line of `svn update` output, posted while it runs. */
    'svn.progress': { line: string }
  }
}
