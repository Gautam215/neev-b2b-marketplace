import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return <main className="min-h-screen bg-graphite p-6 text-white md:p-12"><div className="mx-auto max-w-6xl space-y-6"><Skeleton className="h-5 w-32" /><Skeleton className="h-16 w-2/3" /><Skeleton className="h-80 w-full rounded-apple" /></div></main>
}
