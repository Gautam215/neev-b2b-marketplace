import Link from 'next/link'

export default function WorkspaceRoute() {
  return <main className="grid min-h-screen place-items-center bg-canvas px-6 text-center text-white"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-amber">Workspace route</p><h1 className="mt-4 text-4xl font-semibold tracking-[-.05em]">Open the full operations demo.</h1><p className="mx-auto mt-4 max-w-md text-sm text-ink-2">Use the existing `workspace.html` static proof while the Next.js route is connected to the API service.</p><Link href="/" className="mt-7 inline-flex min-h-11 items-center rounded-xl bg-cobalt px-4 text-sm font-bold text-white">Back to summary</Link></div></main>
}
