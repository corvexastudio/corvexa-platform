import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your automation preferences.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Auto-Reply Template</CardTitle>
          <CardDescription>The SMS message sent when a call is missed.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="template">Message Template</Label>
            <Input id="template" defaultValue="Hey, this is {business_name}! We are on a job and missed your call. How can we help you?" />
            <p className="text-xs text-muted-foreground">Available tags: {'{business_name}'}, {'{customer_name}'}</p>
          </div>
          <Button>Save Template</Button>
        </CardContent>
      </Card>
    </div>
  )
}
