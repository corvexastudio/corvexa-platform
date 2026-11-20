import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load captodesk .env.local
const envPath = 'C:/Users/mskar/captodesk/.env.local';
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value.trim();
  }
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const TRADES_TO_SEED = [
  {
    slug: 'auto-detailing',
    presetKey: 'auto_detailing',
    orgName: 'CaptoDesk Auto Detailing Demo',
    tradeName: 'detailers',
    services: [
      {
        name: 'Mobile Wash, Wax & Interior Vacuum',
        description: '[pricing:starting_at] Hand foam bath, wheels and tires dressed, interior blowout, vacuum, dashboard wipe, and glass cleaned.',
        duration_minutes: 75,
        price: 95,
        requires_address: true,
        is_active: true,
        sort_order: 1
      },
      {
        name: 'Full Signature Interior Detail & Carpet Extraction',
        description: '[pricing:starting_at] Exterior clay bar and wax, hot water carpet and seat extraction, leather conditioning, and odor treatment.',
        duration_minutes: 150,
        price: 185,
        requires_address: true,
        is_active: true,
        sort_order: 2
      },
      {
        name: 'Complete Showroom Detail (Interior + Exterior)',
        description: '[pricing:starting_at] Complete multi-stage paint decontamination, high-gloss machine polish, full interior scrub, and ceramic sealant.',
        duration_minutes: 210,
        price: 295,
        requires_address: true,
        is_active: true,
        sort_order: 3
      },
      {
        name: 'Headlight Restoration & Ceramic Coating',
        description: '[pricing:fixed] 3-stage wet sand, optical compound clarity restoration, and UV-blocking ceramic coating.',
        duration_minutes: 45,
        price: 85,
        requires_address: true,
        is_active: true,
        sort_order: 4
      }
    ],
    templates: {
      auto_reply: "Hi! This is {business_name}. We're in the middle of detailing a vehicle and missed your ring. You can check open driveway slots and book mobile service here: {booking_url}",
      after_hours: "Thanks for calling {business_name}! We're closed for the day. Want to schedule your mobile detail or service? Book online here: {booking_url}",
      busy: "Hey! This is {business_name}. We're currently buffing out a vehicle or on the other line. Reserve your appointment right here: {booking_url}"
    }
  },
  {
    slug: 'plumbing',
    presetKey: 'plumbing',
    orgName: 'CaptoDesk Plumbing & Drain Demo',
    tradeName: 'plumbers',
    services: [
      {
        name: 'Emergency Drain Snaking & Clog Clearing',
        description: '[pricing:starting_at] Heavy-duty electric drain auger service for main line, kitchen sink, or bathroom backup.',
        duration_minutes: 60,
        price: 125,
        requires_address: true,
        is_active: true,
        sort_order: 1
      },
      {
        name: 'Water Heater Diagnostic & Flush',
        description: '[pricing:starting_at] Tank flush, burner assembly diagnostic, element testing, and pressure valve verification.',
        duration_minutes: 60,
        price: 145,
        requires_address: true,
        is_active: true,
        sort_order: 2
      },
      {
        name: 'Full Home Plumbing & Leak Inspection',
        description: '[pricing:fixed] Pressure test, visual camera inspection of accessible lines, toilet seals, and outdoor spigots.',
        duration_minutes: 45,
        price: 89,
        requires_address: true,
        is_active: true,
        sort_order: 3
      }
    ],
    templates: {
      auto_reply: "Hi! This is {business_name}. We are on a service call under a sink and missed your call. Lock in a driveway arrival window here: {booking_url}",
      after_hours: "Thanks for calling {business_name}! Our technicians are off duty, but you can book our next available morning emergency slot here: {booking_url}",
      busy: "Hey! This is {business_name}. We're helping another customer right now. Check our schedule and book directly here: {booking_url}"
    }
  },
  {
    slug: 'hvac',
    presetKey: 'hvac',
    orgName: 'CaptoDesk HVAC & Heating Demo',
    tradeName: 'HVAC contractors',
    services: [
      {
        name: 'AC & Heating Precision Diagnostic',
        description: '[pricing:starting_at] Comprehensive system inspection, refrigerant pressure verification, capacitor testing, and electrical diagnostics.',
        duration_minutes: 60,
        price: 99,
        requires_address: true,
        is_active: true,
        sort_order: 1
      },
      {
        name: 'Seasonal AC & Furnace Tune-Up',
        description: '[pricing:fixed] Complete seasonal cleaning, outdoor condenser coil flush, filter inspection, and airflow verification.',
        duration_minutes: 60,
        price: 129,
        requires_address: true,
        is_active: true,
        sort_order: 2
      },
      {
        name: 'Thermostat Installation & Smart Home Sync',
        description: '[pricing:fixed] Professional wiring, mounting, and smartphone calibration for Google Nest or Ecobee systems.',
        duration_minutes: 45,
        price: 110,
        requires_address: true,
        is_active: true,
        sort_order: 3
      }
    ],
    templates: {
      auto_reply: "Hi! This is {business_name}. Our tech is currently in an attic on an install and missed your ring. Book the next available service slot here: {booking_url}",
      after_hours: "Thanks for reaching out to {business_name}! Our office is closed, but you can reserve our next open AC/Heating arrival window here: {booking_url}",
      busy: "Hey! This is {business_name}. On the other line assisting a homeowner. Grab a spot on our live schedule: {booking_url}"
    }
  },
  {
    slug: 'roofing',
    presetKey: 'roofing',
    orgName: 'CaptoDesk Roofing & Gutters Demo',
    tradeName: 'roofers',
    services: [
      {
        name: 'Full Roof & Attic Drone Inspection',
        description: '[pricing:free_estimate] 4K drone photography, missing shingle inspection, flashing seal check, and written storm damage report.',
        duration_minutes: 45,
        price: 0,
        requires_address: true,
        is_active: true,
        sort_order: 1
      },
      {
        name: 'Gutter Cleaning & Downspout Flush',
        description: '[pricing:starting_at] Hand debris removal, high-pressure downspout flushing, and gutter slope alignment check.',
        duration_minutes: 90,
        price: 145,
        requires_address: true,
        is_active: true,
        sort_order: 2
      },
      {
        name: 'Emergency Shingle Leak Repair',
        description: '[pricing:starting_at] Same-day tarping, flashing reseal, and asphalt shingle patch for active roof leaks.',
        duration_minutes: 90,
        price: 275,
        requires_address: true,
        is_active: true,
        sort_order: 3
      }
    ],
    templates: {
      auto_reply: "Hi! This is {business_name}. We're up on a roof doing an inspection and missed your call. Schedule a free roof inspection or repair here: {booking_url}",
      after_hours: "Thanks for calling {business_name}! We're off the ladders for the evening. Pick a time for our inspector to visit your home: {booking_url}",
      busy: "Hey! This is {business_name}. Helping a client with storm damage. Book an arrival slot directly here: {booking_url}"
    }
  },
  {
    slug: 'landscaping',
    presetKey: 'landscaping',
    orgName: 'CaptoDesk Landscaping & Lawn Demo',
    tradeName: 'landscapers',
    services: [
      {
        name: 'Full Lawn Mow, Edge & Blow Service',
        description: '[pricing:starting_at] Precision mowing, string trimming around obstacles, concrete edging, and blower cleanup.',
        duration_minutes: 45,
        price: 55,
        requires_address: true,
        is_active: true,
        sort_order: 1
      },
      {
        name: 'Seasonal Yard Cleanup & Mulch Installation',
        description: '[pricing:starting_at] Flower bed weeding, bush trimming, dead foliage removal, and premium dark hardwood mulch spreading.',
        duration_minutes: 180,
        price: 245,
        requires_address: true,
        is_active: true,
        sort_order: 2
      },
      {
        name: 'Sprinkler System Inspection & Head Tune',
        description: '[pricing:starting_at] Zone-by-zone pressure testing, broken head replacement, and seasonal controller programming.',
        duration_minutes: 60,
        price: 95,
        requires_address: true,
        is_active: true,
        sort_order: 3
      }
    ],
    templates: {
      auto_reply: "Hi! This is {business_name}. We're operating mowers and couldn't hear the ring! Grab a spot on our lawn route here: {booking_url}",
      after_hours: "Thanks for calling {business_name}! Our crews are done for the day. You can book an estimate or recurring mow service here: {booking_url}",
      busy: "Hey! This is {business_name}. Currently out on a job site. Reserve your lawn service anytime online: {booking_url}"
    }
  },
  {
    slug: 'cleaning',
    presetKey: 'cleaning',
    orgName: 'CaptoDesk House Cleaning Demo',
    tradeName: 'cleaners',
    services: [
      {
        name: 'Standard Home Maintenance Clean',
        description: '[pricing:starting_at] Kitchen countertops & appliances exterior, bathroom sanitization, dusting, vacuuming, and mop.',
        duration_minutes: 120,
        price: 135,
        requires_address: true,
        is_active: true,
        sort_order: 1
      },
      {
        name: 'Deep Clean & Baseboards Scrub',
        description: '[pricing:starting_at] Top-to-bottom scrub including baseboards, door frames, inside microwave, bathroom grout, and interior glass.',
        duration_minutes: 240,
        price: 245,
        requires_address: true,
        is_active: true,
        sort_order: 2
      },
      {
        name: 'Move-In / Move-Out Turnover Clean',
        description: '[pricing:starting_at] Empty house deep clean including inside oven, inside refrigerator, cabinet interiors, and closet shelves.',
        duration_minutes: 300,
        price: 320,
        requires_address: true,
        is_active: true,
        sort_order: 3
      }
    ],
    templates: {
      auto_reply: "Hi! This is {business_name}. We're in the middle of a home clean and stepped away from the phone. Book your cleaning slot here: {booking_url}",
      after_hours: "Thanks for reaching out to {business_name}! Our office is closed, but you can reserve your upcoming home cleaning slot here: {booking_url}",
      busy: "Hey! This is {business_name}. Assisting another client right now. Pick an open cleaning date here: {booking_url}"
    }
  },
  {
    slug: 'electrical',
    presetKey: 'electrical',
    orgName: 'CaptoDesk Electrical Services Demo',
    tradeName: 'electricians',
    services: [
      {
        name: 'Electrical Safety Diagnostic & Troubleshooting',
        description: '[pricing:starting_at] Breaker tripping diagnosis, outlet testing, wiring integrity check, and safety code inspection.',
        duration_minutes: 60,
        price: 125,
        requires_address: true,
        is_active: true,
        sort_order: 1
      },
      {
        name: 'EV Home Charger Installation Consultation',
        description: '[pricing:free_estimate] Panel capacity load evaluation, conduit pathway routing, and 240V Level 2 charger installation quote.',
        duration_minutes: 45,
        price: 0,
        requires_address: true,
        is_active: true,
        sort_order: 2
      },
      {
        name: 'Ceiling Fan & Light Fixture Installation',
        description: '[pricing:starting_at] Removal of old fixture, junction box reinforcement, fan mounting, and wall switch wiring.',
        duration_minutes: 90,
        price: 145,
        requires_address: true,
        is_active: true,
        sort_order: 3
      }
    ],
    templates: {
      auto_reply: "Hi! This is {business_name}. Our electrician is currently working on an active panel and missed your call. Book our next service window here: {booking_url}",
      after_hours: "Thanks for calling {business_name}! We're closed for the night. You can book an electrician visit directly online here: {booking_url}",
      busy: "Hey! This is {business_name}. On another line helping a customer. Check our schedule and book your electrical service here: {booking_url}"
    }
  },
  {
    slug: 'pressure-washing',
    presetKey: 'pressure_washing',
    orgName: 'CaptoDesk Pressure Washing Demo',
    tradeName: 'pressure washers',
    services: [
      {
        name: 'Driveway & Sidewalk Surface Cleaning',
        description: '[pricing:starting_at] High-flow rotary surface scrubber clean to remove tire marks, algae, oil stains, and organic buildup.',
        duration_minutes: 90,
        price: 150,
        requires_address: true,
        is_active: true,
        sort_order: 1
      },
      {
        name: 'Soft Wash Home Siding Cleaning',
        description: '[pricing:starting_at] Low-pressure chemical soft wash to kill green mildew, dirt, and wasp nests without siding damage.',
        duration_minutes: 150,
        price: 245,
        requires_address: true,
        is_active: true,
        sort_order: 2
      },
      {
        name: 'Backyard Patio & Pool Deck Restoration',
        description: '[pricing:starting_at] Concrete, travertine, or paver wash to eliminate slip hazards and restore original color.',
        duration_minutes: 120,
        price: 185,
        requires_address: true,
        is_active: true,
        sort_order: 3
      }
    ],
    templates: {
      auto_reply: "Hi! This is {business_name}. We're operating a high-pressure washer and missed your ring. Book your exterior wash arrival window here: {booking_url}",
      after_hours: "Thanks for reaching out to {business_name}! We're closed for the evening. Pick a time on our schedule for your driveway or house wash: {booking_url}",
      busy: "Hey! This is {business_name}. Currently washing a property. Reserve your appointment right here: {booking_url}"
    }
  }
];

async function seedTrades() {
  console.log(`Starting seed for ${TRADES_TO_SEED.length} trades in CaptoDesk...`);

  for (const trade of TRADES_TO_SEED) {
    // 1. Check if organization exists by slug
    const { data: existingOrg } = await supabase
      .from('organizations')
      .select('id, name, slug')
      .eq('slug', trade.slug)
      .maybeSingle();

    let orgId;

    const orgPayload = {
      name: trade.orgName,
      slug: trade.slug,
      industry: trade.presetKey,
      status: 'active',
      subscription_status: 'active',
      plan_id: 'solo',
      booking_mode: 'instant',
      default_duration_minutes: 60,
      buffer_minutes: 15,
      minimum_notice_hours: 2,
      max_booking_days_ahead: 30,
      auto_reply_template: trade.templates.auto_reply,
      after_hours_template: trade.templates.after_hours,
      busy_template: trade.templates.busy,
      business_hours: {
        monday: { open: '08:00', close: '18:00', closed: false },
        tuesday: { open: '08:00', close: '18:00', closed: false },
        wednesday: { open: '08:00', close: '18:00', closed: false },
        thursday: { open: '08:00', close: '18:00', closed: false },
        friday: { open: '08:00', close: '18:00', closed: false },
        saturday: { open: '09:00', close: '15:00', closed: false },
        sunday: { open: '00:00', close: '00:00', closed: true }
      },
      timezone: 'America/Chicago',
      updated_at: new Date().toISOString()
    };

    if (existingOrg) {
      orgId = existingOrg.id;
      const { error: updErr } = await supabase
        .from('organizations')
        .update(orgPayload)
        .eq('id', orgId);
      if (updErr) console.error(`Error updating org ${trade.slug}:`, updErr);
      else console.log(`✓ Updated org: ${trade.orgName} (slug: ${trade.slug})`);
    } else {
      const { data: newOrg, error: insErr } = await supabase
        .from('organizations')
        .insert([orgPayload])
        .select('id')
        .single();
      if (insErr) {
        console.error(`Error creating org ${trade.slug}:`, insErr);
        continue;
      }
      orgId = newOrg.id;
      console.log(`✓ Created new org: ${trade.orgName} (slug: ${trade.slug})`);
    }

    // 2. Clean old services for this org and insert trade services
    await supabase.from('services').delete().eq('org_id', orgId);

    const servicesToInsert = trade.services.map(s => ({
      org_id: orgId,
      name: s.name,
      description: s.description,
      duration_minutes: s.duration_minutes,
      price: s.price,
      requires_address: s.requires_address,
      is_active: true,
      sort_order: s.sort_order,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    const { error: srvErr } = await supabase.from('services').insert(servicesToInsert);
    if (srvErr) console.error(`Error inserting services for ${trade.slug}:`, srvErr);
    else console.log(`  -> Inserted ${servicesToInsert.length} active services for ${trade.slug}`);
  }

  // Also update demo org 'captodesk-demo-services-rdhr6' to match auto-detailing services so legacy links work
  const { data: legacyOrg } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', 'captodesk-demo-services-rdhr6')
    .maybeSingle();

  if (legacyOrg) {
    const autoTrade = TRADES_TO_SEED.find(t => t.slug === 'auto-detailing');
    await supabase.from('organizations').update({
      industry: 'auto_detailing',
      auto_reply_template: autoTrade.templates.auto_reply,
      after_hours_template: autoTrade.templates.after_hours,
      busy_template: autoTrade.templates.busy,
      updated_at: new Date().toISOString()
    }).eq('id', legacyOrg.id);

    await supabase.from('services').delete().eq('org_id', legacyOrg.id);
    const legacyServices = autoTrade.services.map(s => ({
      org_id: legacyOrg.id,
      name: s.name,
      description: s.description,
      duration_minutes: s.duration_minutes,
      price: s.price,
      requires_address: s.requires_address,
      is_active: true,
      sort_order: s.sort_order,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));
    await supabase.from('services').insert(legacyServices);
    console.log('✓ Synced legacy org captodesk-demo-services-rdhr6 to Auto Detailing preset');
  }

  console.log('\nAll 8 Trade Demo Organizations are fully seeded and live!');
}

seedTrades();
