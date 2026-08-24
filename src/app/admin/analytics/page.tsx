import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function PlatformAnalytics() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Platform Analytics</h1>
        <p className="text-slate-400">Aggregate metrics across all tenants.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="bg-slate-900 border-slate-800 text-slate-50">
          <CardHeader>
            <CardTitle>Total Missed Calls Saved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">1,204</div>
          </CardContent>
        </Card>
        
        <Card className="bg-slate-900 border-slate-800 text-slate-50">
          <CardHeader>
            <CardTitle>Total Review Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">4,591</div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
