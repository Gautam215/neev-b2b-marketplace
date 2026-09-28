'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('Neev route boundary:', error) }, [error])
  return <main className="grid min-h-screen place-items-center bg-graphite px-6 text-center text-white"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-lime">Something needs attention</p><h1 className="mt-4 text-4xl font-semibold tracking-[-.05em]">The summary could not load.</h1><p className="mx-auto mt-4 max-w-md text-sm text-mist">Your saved local state is safe. Try the request again, or return to the workspace.</p><div className="mt-7 flex justify-center gap-3"><Button onClick={reset}>Try again</Button><Button variant="secondary" onClick={() => window.location.assign('/workspace')}>Open workspace</Button></div></div></main>
}
