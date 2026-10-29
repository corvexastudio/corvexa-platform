import { redirect } from 'next/navigation'

interface JobsPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>
}

// P3-001: Server-side redirect from legacy /client/jobs to unified Schedule & Jobs calendar with Dispatch List view
// (Supercedes legacy client-side router.replace to eliminate loading flash and perform instant HTTP 307 server redirect)
export default async function JobsPage({ searchParams }: JobsPageProps) {
  const resolvedParams = searchParams ? await searchParams : {}
  const params = new URLSearchParams()

  if (resolvedParams) {
    for (const [key, value] of Object.entries(resolvedParams)) {
      if (Array.isArray(value)) {
        value.forEach((v) => params.append(key, v))
      } else if (value !== undefined) {
        params.set(key, value)
      }
    }
  }

  if (!params.has('view')) {
    params.set('view', 'list')
  }

  const queryString = params.toString()
  redirect(`/client/calendar${queryString ? `?${queryString}` : '?view=list'}`)
}
