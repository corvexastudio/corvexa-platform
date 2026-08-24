import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function TeamPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Team Management</h1>
        <p className="text-muted-foreground">Manage your co-workers and dispatchers.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Members</CardTitle>
          <CardDescription>Invite team members to access the dashboard.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">You are currently the only member.</div>
          <Button className="mt-4">Invite Member</Button>
        </CardContent>
      </Card>
    </div>
  )
}
