import { createAdminClient } from '../src/lib/supabase/admin.ts'
import { encodeAddOns } from '../src/lib/services/service-pricing.ts'

const supabase = createAdminClient()

async function run() {
  const { data: org } = await supabase.from('organizations').select('id').eq('slug', 'auto-detailing').single()
  if (!org) {
    console.log('Org not found')
    return
  }
  const { data: svcs } = await supabase.from('services').select('id, name, description').eq('org_id', org.id)
  console.log('Found', svcs.length, 'services')
  const s2 = svcs.find(s => s.name.includes('Signature'))
  if (s2) {
    const addons = [
      { id: 'add-ozone', name: 'Ozone Odor Elimination Treatment', price: 60.00, duration_minutes: 45, description: 'Medical grade shock treatment destroying smoke and pet odors' },
      { id: 'add-engine', name: 'Engine Bay Foam & Dressing', price: 45.00, duration_minutes: 30, description: 'Degrease and condition under-hood plastic and hoses' },
      { id: 'add-leather', name: 'Ceramic Leather Shield Conditioner', price: 35.00, duration_minutes: 15, description: 'UV blocking hydrophobic leather protection' }
    ]
    const clean = s2.description.replace(/\[addons:[^\]]+\]/g, '').trim()
    const newDesc = `${clean} ${encodeAddOns(addons)}`
    await supabase.from('services').update({ description: newDesc }).eq('id', s2.id)
    console.log('Successfully updated Signature service with 3 add-ons!')
  }
}

run().catch(console.error)
