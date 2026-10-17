export interface IndustryServicePreset {
  name: string
  description: string
  duration_minutes: number
  price: number | null
  requires_address: boolean
  is_active: boolean
  sort_order: number
}

export interface IndustryTemplates {
  auto_reply: string
  after_hours: string
  busy: string
}

export interface IndustryPreset {
  id: string
  name: string
  icon: string
  badge: string
  description: string
  services: IndustryServicePreset[]
  templates: IndustryTemplates
}

export const INDUSTRY_PRESETS: Record<string, IndustryPreset> = {
  hvac: {
    id: 'hvac',
    name: 'HVAC & Heating / Cooling',
    icon: 'Thermometer',
    badge: 'Heating & AC',
    description: 'Residential & commercial heating, ventilation, and air conditioning contractors.',
    services: [
      {
        name: 'AC & Heating Diagnostic Inspection',
        description: 'Comprehensive system inspection, electrical checks, refrigerant pressure verification, and diagnostic quote.',
        duration_minutes: 45,
        price: 79,
        requires_address: true,
        is_active: true,
        sort_order: 1
      },
      {
        name: 'Seasonal HVAC Precision Tune-Up',
        description: 'Complete seasonal cleaning, coil inspection, filter change check, capacitor testing, and efficiency tune.',
        duration_minutes: 60,
        price: 99,
        requires_address: true,
        is_active: true,
        sort_order: 2
      },
      {
        name: 'Emergency Heating & AC Repair Service',
        description: 'Priority diagnostic and emergency on-site repair for active furnace failures, AC breakdowns, or thermostat issues.',
        duration_minutes: 60,
        price: 149,
        requires_address: true,
        is_active: true,
        sort_order: 3
      }
    ],
    templates: {
      auto_reply: "Hi, this is {business_name}! We're currently in the field on a service call and missed your call. Need fast HVAC assistance? Book your preferred service time here: {booking_url}",
      after_hours: "Thanks for calling {business_name}! Our heating and cooling team is off for the evening. We received your missed call—secure your spot for tomorrow at: {booking_url}",
      busy: "Hi, this is {business_name}! Our technicians are currently on active calls assisting homeowners. You can view open appointments and book directly: {booking_url}"
    }
  },

  plumbing: {
    id: 'plumbing',
    name: 'Plumbing & Drain Cleaning',
    icon: 'Droplets',
    badge: 'Pipes & Drains',
    description: 'Emergency plumbing, pipe repair, water heaters, and drain rooter services.',
    services: [
      {
        name: 'Drain Snaking & Clog Clearing',
        description: 'Mechanical drain snaking and rooter clearing for clogged kitchen sinks, bathtubs, or main sewer lines.',
        duration_minutes: 60,
        price: 129,
        requires_address: true,
        is_active: true,
        sort_order: 1
      },
      {
        name: 'Plumbing Leak Diagnostic & Pipe Inspection',
        description: 'On-site diagnostic inspection to pinpoint pipe leaks, running toilets, low water pressure, or valve failures.',
        duration_minutes: 45,
        price: 69,
        requires_address: true,
        is_active: true,
        sort_order: 2
      },
      {
        name: 'Water Heater Flush & Repair Service',
        description: 'Tank flush, anode rod inspection, burner/element diagnostic, temperature relief test, or repair assessment.',
        duration_minutes: 60,
        price: 150,
        requires_address: true,
        is_active: true,
        sort_order: 3
      }
    ],
    templates: {
      auto_reply: "Hello! This is {business_name}. We're mid-job on a plumbing service call and missed you. Need immediate help or booking? Choose a time right here: {booking_url}",
      after_hours: "Thanks for contacting {business_name}! Our plumbing crew is closed for the evening. If you need priority service tomorrow morning, pick a time here: {booking_url}",
      busy: "Hi! This is {business_name}. We're currently on the other line assisting a homeowner with a plumbing issue. Reserve a service window directly at: {booking_url}"
    }
  },

  electrical: {
    id: 'electrical',
    name: 'Electrical & Lighting',
    icon: 'Zap',
    badge: 'Wiring & Power',
    description: 'Licensed electricians for residential wiring, panel upgrades, lighting, and EV chargers.',
    services: [
      {
        name: 'Electrical Troubleshooting & Diagnostic Call',
        description: 'Professional circuit troubleshooting, flickering lights inspection, tripping breaker diagnostic, and safety check.',
        duration_minutes: 60,
        price: 89,
        requires_address: true,
        is_active: true,
        sort_order: 1
      },
      {
        name: 'Outlet, Switch & Fixture Installation',
        description: 'Replacement and installation of GFCI outlets, dimmer switches, ceiling fans, or light fixtures.',
        duration_minutes: 45,
        price: 120,
        requires_address: true,
        is_active: true,
        sort_order: 2
      },
      {
        name: 'Panel Upgrade & EV Charger Consultation',
        description: 'On-site load calculation and quote for 200A panel upgrades, subpanel installation, or Level 2 EV charging.',
        duration_minutes: 60,
        price: 0,
        requires_address: true,
        is_active: true,
        sort_order: 3
      }
    ],
    templates: {
      auto_reply: "Hi from {business_name}! We're on an electrical installation job and missed your call. Want to book an electrician diagnostic? Choose an open slot here: {booking_url}",
      after_hours: "Thanks for calling {business_name}! Our office is closed for the night. You can schedule an electrical service appointment online 24/7 at: {booking_url}",
      busy: "Hello! This is {business_name}. Our master electricians are currently on the line or on-site. Lock in your preferred service time here: {booking_url}"
    }
  },

  roofing: {
    id: 'roofing',
    name: 'Roofing & Gutters',
    icon: 'Home',
    badge: 'Roof & Gutters',
    description: 'Roof inspections, shingle repairs, gutter cleaning, and storm damage assessments.',
    services: [
      {
        name: 'Roof Inspection & Storm Damage Assessment',
        description: 'Full roof pitch inspection, shingle condition evaluation, leak assessment, and free insurance estimate.',
        duration_minutes: 60,
        price: 0,
        requires_address: true,
        is_active: true,
        sort_order: 1
      },
      {
        name: 'Gutter Cleaning & Downspout Flush',
        description: 'Hand clearing of all roof gutters, downspout flush, seam leak inspection, and property perimeter cleanup.',
        duration_minutes: 90,
        price: 149,
        requires_address: true,
        is_active: true,
        sort_order: 2
      },
      {
        name: 'Emergency Roof Leak Tarping & Repair Assessment',
        description: 'Urgent on-site dispatch to mitigate active roof leaks, secure storm tarps, and document structural damage.',
        duration_minutes: 60,
        price: 199,
        requires_address: true,
        is_active: true,
        sort_order: 3
      }
    ],
    templates: {
      auto_reply: "Hi! This is {business_name}. We're up on a roof right now and couldn't answer safely. To book a free inspection or estimate, tap here: {booking_url}",
      after_hours: "Thanks for calling {business_name}! Our team is wrapped up for today. For roof leak inspections or gutter services, book your appointment here: {booking_url}",
      busy: "Hi from {business_name}! We're currently reviewing project estimates with a client. Reserve an open consultation window here: {booking_url}"
    }
  },

  landscaping: {
    id: 'landscaping',
    name: 'Landscaping & Lawn Care',
    icon: 'Trees',
    badge: 'Lawn & Yard',
    description: 'Mowing, seasonal property cleanups, mulching, sod installation, and yard maintenance.',
    services: [
      {
        name: 'Standard Lawn Mowing, Edging & Blowing',
        description: 'Turf mowing, line trimming around beds and fences, perimeter blade edging, and hardscape blowing.',
        duration_minutes: 45,
        price: 55,
        requires_address: true,
        is_active: true,
        sort_order: 1
      },
      {
        name: 'Seasonal Yard Cleanup & Leaf Removal',
        description: 'Spring/Fall property cleanup, garden bed clear-out, pruning, leaf removal, and organic green waste hauling.',
        duration_minutes: 120,
        price: 195,
        requires_address: true,
        is_active: true,
        sort_order: 2
      },
      {
        name: 'Mulch Installation & Bed Refresh',
        description: 'Fresh natural hardwood/dyed mulch delivery, trench edging along landscape beds, and uniform weed-barrier install.',
        duration_minutes: 90,
        price: 165,
        requires_address: true,
        is_active: true,
        sort_order: 3
      }
    ],
    templates: {
      auto_reply: "Hey there! This is {business_name}. Our crew is outside running mowers and missed your call. Pick a time for your service or free lawn estimate here: {booking_url}",
      after_hours: "Thanks for calling {business_name}! Our crew has clocked out for the day. You can view open dates and book your lawn service directly at: {booking_url}",
      busy: "Hey, this is {business_name}! We're out on a landscape job site right now. Book your estimate or service time directly: {booking_url}"
    }
  },

  cleaning: {
    id: 'cleaning',
    name: 'Cleaning & Housekeeping',
    icon: 'Sparkles',
    badge: 'Home & Maid',
    description: 'Residential house cleaning, deep cleaning, Airbnb turnovers, and office sanitation.',
    services: [
      {
        name: 'Standard Recurring House Cleaning',
        description: 'Thorough dusting, vacuuming, mopping, bathroom sanitization, kitchen countertops, and appliance exterior wipe-down.',
        duration_minutes: 120,
        price: 140,
        requires_address: true,
        is_active: true,
        sort_order: 1
      },
      {
        name: 'Deep Clean & Detail Sanitation',
        description: 'Top-to-bottom deep clean including baseboards, interior windows, cabinet faces, oven exterior, and tile grout scrub.',
        duration_minutes: 180,
        price: 250,
        requires_address: true,
        is_active: true,
        sort_order: 2
      },
      {
        name: 'Move-In / Move-Out Turnover Clean',
        description: 'Complete empty-home vacant turnaround cleaning including inside cabinets, pantry, fridge, and deep fixture detailing.',
        duration_minutes: 240,
        price: 320,
        requires_address: true,
        is_active: true,
        sort_order: 3
      }
    ],
    templates: {
      auto_reply: "Hi! This is {business_name}. We're currently cleaning a home and missed your call. See our real-time availability and book your clean here: {booking_url}",
      after_hours: "Thanks for contacting {business_name}! Our office is closed for the evening. You can check prices and book your home cleaning anytime at: {booking_url}",
      busy: "Hi from {business_name}! We're currently assisting another client or on-site cleaning. Choose your preferred cleaning slot directly at: {booking_url}"
    }
  },

  pest_control: {
    id: 'pest_control',
    name: 'Pest Control & Extermination',
    icon: 'Bug',
    badge: 'Pest & Rodent',
    description: 'Insects, rodents, termites, mosquitoes, and preventative home barrier treatments.',
    services: [
      {
        name: 'General Pest Inspection & Exterior Barrier Treatment',
        description: 'Comprehensive home perimeter inspection and protective exterior liquid barrier against ants, roaches, and spiders.',
        duration_minutes: 60,
        price: 95,
        requires_address: true,
        is_active: true,
        sort_order: 1
      },
      {
        name: 'Termite & Structural Wood Inspection',
        description: 'Certified attic, crawlspace, and foundation inspection for subterranean termites, wood rot, or carpenter ants.',
        duration_minutes: 60,
        price: 75,
        requires_address: true,
        is_active: true,
        sort_order: 2
      },
      {
        name: 'Emergency Hornet, Wasp & Nest Removal',
        description: 'Targeted knockdown and removal of active bee/wasp hives, yellow jacket nests, or exterior insect clusters.',
        duration_minutes: 45,
        price: 125,
        requires_address: true,
        is_active: true,
        sort_order: 3
      }
    ],
    templates: {
      auto_reply: "Hello! This is {business_name}. We're in the field spraying and missed your call. To schedule your pest inspection or treatment, book here: {booking_url}",
      after_hours: "Thanks for contacting {business_name}! We are closed for the evening, but you can book a pest inspection online 24/7 at: {booking_url}",
      busy: "Hi, this is {business_name}! Our technicians are currently treating a property. You can reserve an inspection slot directly at: {booking_url}"
    }
  },

  auto_detailing: {
    id: 'auto_detailing',
    name: 'Auto Detailing & Mobile Mechanic',
    icon: 'Car',
    badge: 'Auto & Mobile',
    description: 'Mobile car washing, interior shampoo, paint correction, ceramic coatings, and mobile diagnostics.',
    services: [
      {
        name: 'Mobile Wash, Wax & Interior Vacuum',
        description: 'Hand foam bath, wheels and tires dressed, complete interior blowout, vacuum, dashboard wiped, and windows cleaned.',
        duration_minutes: 75,
        price: 120,
        requires_address: true,
        is_active: true,
        sort_order: 1
      },
      {
        name: 'Full Signature Detail & Carpet Shampoo',
        description: 'Complete exterior clay bar and wax, hot water carpet and seat extraction, leather conditioning, and odor treatment.',
        duration_minutes: 150,
        price: 240,
        requires_address: true,
        is_active: true,
        sort_order: 2
      },
      {
        name: 'Mobile Vehicle Diagnostic & Brake Check',
        description: 'OBD2 computer scan, brake pad and rotor wear assessment, battery/alternator test, and mobile repair estimate.',
        duration_minutes: 60,
        price: 89,
        requires_address: true,
        is_active: true,
        sort_order: 3
      }
    ],
    templates: {
      auto_reply: "Hi! This is {business_name}. We're in the middle of detailing a vehicle and missed your ring. You can check open slots and book mobile service here: {booking_url}",
      after_hours: "Thanks for calling {business_name}! We're closed for the day. Want to schedule your mobile detail or service? Book online here: {booking_url}",
      busy: "Hey! This is {business_name}. We're currently buffing out a vehicle or on the other line. Reserve your appointment right here: {booking_url}"
    }
  },

  handyman: {
    id: 'handyman',
    name: 'Handyman & Home Repairs',
    icon: 'Hammer',
    badge: 'Repairs & Fixes',
    description: 'Carpentry, door repairs, drywall patching, fixtures, painting, and small home improvements.',
    services: [
      {
        name: 'General Handyman Hourly Repair Visit',
        description: 'Up to 1 hour of professional repair labor for drywall patching, hardware installation, door adjustments, or caulking.',
        duration_minutes: 60,
        price: 85,
        requires_address: true,
        is_active: true,
        sort_order: 1
      },
      {
        name: 'Home Remodel & Repair Estimate Consultation',
        description: 'In-person walk-through of your upcoming repair, renovation, or carpentry project with a detailed written estimate.',
        duration_minutes: 45,
        price: 0,
        requires_address: true,
        is_active: true,
        sort_order: 2
      },
      {
        name: 'Drywall Patch, Sand & Prime Repair',
        description: 'Repair up to 2 medium drywall holes, smooth compound sanding, mesh reinforcement, and primer touchup.',
        duration_minutes: 90,
        price: 135,
        requires_address: true,
        is_active: true,
        sort_order: 3
      }
    ],
    templates: {
      auto_reply: "Hi, this is {business_name}! We're on a job site with power tools running and missed your call. To book a repair visit or estimate, click here: {booking_url}",
      after_hours: "Thanks for calling {business_name}! We are closed for the day. Feel free to book a consultation or service time on our calendar: {booking_url}",
      busy: "Hi from {business_name}! We're on a project site or speaking with another homeowner. Reserve your appointment online here: {booking_url}"
    }
  },

  general: {
    id: 'general',
    name: 'General & Professional Services',
    icon: 'Briefcase',
    badge: 'Services & Consult',
    description: 'Consulting, pet care, tutoring, wellness, photography, or any independent service provider.',
    services: [
      {
        name: 'Initial Consultation & Needs Assessment',
        description: 'Introductory consultation to evaluate your goals, answer questions, and provide a customized service plan.',
        duration_minutes: 45,
        price: 0,
        requires_address: false,
        is_active: true,
        sort_order: 1
      },
      {
        name: 'Standard Service Appointment',
        description: 'One hour standard on-site or virtual service appointment tailored to your individual requirements.',
        duration_minutes: 60,
        price: 85,
        requires_address: true,
        is_active: true,
        sort_order: 2
      },
      {
        name: 'Extended Service Session',
        description: 'Comprehensive two-hour in-depth service delivery, maintenance, or project milestone review.',
        duration_minutes: 120,
        price: 160,
        requires_address: true,
        is_active: true,
        sort_order: 3
      }
    ],
    templates: {
      auto_reply: "Hi, this is {business_name}! We're currently with a client and missed your call. You can view our availability and book directly here: {booking_url}",
      after_hours: "Thanks for calling {business_name}! Our office is closed for the day, but you can schedule an appointment online anytime: {booking_url}",
      busy: "Hi, this is {business_name}! We're currently on the other line. Please reserve an appointment directly at: {booking_url}"
    }
  }
}

export const INDUSTRY_LIST = Object.values(INDUSTRY_PRESETS)

export function getIndustryPreset(id?: string | null): IndustryPreset {
  if (!id) return INDUSTRY_PRESETS.general
  const normalized = id.toLowerCase().trim()
  return INDUSTRY_PRESETS[normalized] || INDUSTRY_PRESETS.general
}
