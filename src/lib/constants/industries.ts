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
        description: '[pricing:diagnostic_fee] Comprehensive system inspection, electrical checks, refrigerant pressure verification, and diagnostic quote.',
        duration_minutes: 45,
        price: 89,
        requires_address: true,
        is_active: true,
        sort_order: 1
      },
      {
        name: 'Seasonal HVAC Precision Tune-Up',
        description: '[pricing:fixed] Complete seasonal cleaning, coil inspection, filter change check, capacitor testing, and efficiency tune.',
        duration_minutes: 60,
        price: 99,
        requires_address: true,
        is_active: true,
        sort_order: 2
      },
      {
        name: 'Emergency Heating & AC Repair Service',
        description: '[pricing:quote_on_site] Priority diagnostic and on-site repair for furnace failures, AC breakdowns, or thermostat issues. Exact quote provided on site.',
        duration_minutes: 60,
        price: null,
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
        name: 'Plumbing Diagnostic & Leak Inspection',
        description: '[pricing:diagnostic_fee] On-site diagnostic inspection to pinpoint pipe leaks, running toilets, low water pressure, or valve failures. Credited to repair if approved.',
        duration_minutes: 45,
        price: 69,
        requires_address: true,
        is_active: true,
        sort_order: 1
      },
      {
        name: 'Main Drain & Sewer Rooter Clearing',
        description: '[pricing:starting_at] Mechanical snake clearing and rooter service for clogged main drains, kitchen stacks, or sewer cleanouts.',
        duration_minutes: 60,
        price: 145,
        requires_address: true,
        is_active: true,
        sort_order: 2
      },
      {
        name: 'Water Heater Diagnostic & Flush',
        description: '[pricing:quote_on_site] Tank flush, burner assembly diagnostic, element testing, pressure valve check, or full replacement consultation.',
        duration_minutes: 60,
        price: null,
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
        description: '[pricing:diagnostic_fee] Circuit troubleshooting, flickering lights inspection, tripping breaker diagnostic, and electrical safety check.',
        duration_minutes: 60,
        price: 89,
        requires_address: true,
        is_active: true,
        sort_order: 1
      },
      {
        name: 'Outlet, Switch & Fixture Installation',
        description: '[pricing:starting_at] Professional installation of GFCI receptacles, dimmer switches, ceiling fans, or interior light fixtures.',
        duration_minutes: 60,
        price: 120,
        requires_address: true,
        is_active: true,
        sort_order: 2
      },
      {
        name: 'EV Charger & Panel Upgrade Consultation',
        description: '[pricing:quote_on_site] On-site electrical load calculation and estimate for Level 2 EV charger installs, subpanels, or 200A service upgrades.',
        duration_minutes: 60,
        price: null,
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
        description: '[pricing:free_estimate] Full pitch and flashing inspection, shingle condition report, leak assessment, and free insurance claim quote.',
        duration_minutes: 60,
        price: 0,
        requires_address: true,
        is_active: true,
        sort_order: 1
      },
      {
        name: 'Seamless Gutter Cleaning & Downspout Flush',
        description: '[pricing:fixed] Hand clearing of roof gutters, high-volume downspout water flush, seam leak inspection, and debris hauling.',
        duration_minutes: 90,
        price: 149,
        requires_address: true,
        is_active: true,
        sort_order: 2
      },
      {
        name: 'Emergency Roof Leak Tarping & Repair',
        description: '[pricing:quote_on_site] Urgent on-site dispatch to mitigate active roof leaks, secure protective tarps, and provide permanent repair options.',
        duration_minutes: 60,
        price: null,
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
        name: 'Lawn Mowing, Trimming & Edging',
        description: '[pricing:starting_at] Perimeter blade edging, turf mowing, fence line weed-whacking, and hardscape clean blower sweep.',
        duration_minutes: 45,
        price: 55,
        requires_address: true,
        is_active: true,
        sort_order: 1
      },
      {
        name: 'Seasonal Property Cleanup & Leaf Removal',
        description: '[pricing:quote_on_site] Spring or fall landscape cleanup, bed weeding, light shrub pruning, leaf collection, and green waste haul away.',
        duration_minutes: 120,
        price: null,
        requires_address: true,
        is_active: true,
        sort_order: 2
      },
      {
        name: 'Mulch Installation & Bed Refresh',
        description: '[pricing:quote_on_site] Fresh dyed or hardwood mulch delivery, edge trenching along garden beds, and weed-barrier check.',
        duration_minutes: 90,
        price: null,
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
        name: 'Standard Recurring House Clean',
        description: '[pricing:starting_at] Complete home dusting, vacuuming, mopping, bathroom sanitation, kitchen counters, and trash removal.',
        duration_minutes: 120,
        price: 140,
        requires_address: true,
        is_active: true,
        sort_order: 1
      },
      {
        name: 'Deep Clean & Detailed Scrub',
        description: '[pricing:starting_at] Top-to-bottom detail clean including baseboards, interior windows, cabinet exteriors, and bathroom tile scrub.',
        duration_minutes: 180,
        price: 250,
        requires_address: true,
        is_active: true,
        sort_order: 2
      },
      {
        name: 'Move-In / Move-Out Vacant Home Clean',
        description: '[pricing:quote_on_site] Comprehensive turnover clean for vacant properties including inside oven, refrigerator, cabinets, and closets.',
        duration_minutes: 240,
        price: null,
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
        name: 'General Pest Inspection & Exterior Barrier',
        description: '[pricing:fixed] Comprehensive perimeter inspection and protective exterior liquid barrier defense against ants, spiders, and roaches.',
        duration_minutes: 60,
        price: 95,
        requires_address: true,
        is_active: true,
        sort_order: 1
      },
      {
        name: 'Termite & Wood-Destroying Organism Inspection',
        description: '[pricing:diagnostic_fee] Certified crawlspace, attic, and foundation inspection for subterranean termites, carpenter ants, and moisture damage.',
        duration_minutes: 60,
        price: 75,
        requires_address: true,
        is_active: true,
        sort_order: 2
      },
      {
        name: 'Wasp, Hornet & Stinging Insect Knockdown',
        description: '[pricing:quote_on_site] Targeted removal of active bee/wasp hives, yellow jacket nests, or exterior insect clusters.',
        duration_minutes: 45,
        price: null,
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

  handyman: {
    id: 'handyman',
    name: 'Handyman & Home Repairs',
    icon: 'Hammer',
    badge: 'Repairs & Fixes',
    description: 'Carpentry, door repairs, drywall patching, fixtures, painting, and small home improvements.',
    services: [
      {
        name: 'General Handyman Hourly Service Call',
        description: '[pricing:fixed] 1 hour of professional repair labor for door adjustments, drywall patches, hardware, caulking, or shelf mounting.',
        duration_minutes: 60,
        price: 85,
        requires_address: true,
        is_active: true,
        sort_order: 1
      },
      {
        name: 'Drywall Patch, Tape & Texture Repair',
        description: '[pricing:starting_at] Repair of holes or water damage up to 2 locations, smooth compound mudding, mesh reinforcement, and primer prep.',
        duration_minutes: 90,
        price: 140,
        requires_address: true,
        is_active: true,
        sort_order: 2
      },
      {
        name: 'Custom Carpentry & Home Improvement Walkthrough',
        description: '[pricing:free_estimate] In-person walk-through of your upcoming repair, door replacement, or carpentry project with a detailed written estimate.',
        duration_minutes: 45,
        price: 0,
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

  appliance_repair: {
    id: 'appliance_repair',
    name: 'Appliance Repair',
    icon: 'Wrench',
    badge: 'Appliance Pro',
    description: 'Refrigerators, washers, dryers, dishwashers, ovens, and residential kitchen/laundry appliances.',
    services: [
      {
        name: 'Refrigerator & Freezer Diagnostic Inspection',
        description: '[pricing:diagnostic_fee] Comprehensive diagnostic for cooling failures, compressor issues, ice makers, or water dispenser leaks. Credited to repair if approved.',
        duration_minutes: 45,
        price: 89,
        requires_address: true,
        is_active: true,
        sort_order: 1
      },
      {
        name: 'Washer & Dryer Diagnostic Service',
        description: '[pricing:diagnostic_fee] Troubleshooting for spin cycle failures, heating element burnout, drainage pumps, or noisy bearings.',
        duration_minutes: 45,
        price: 89,
        requires_address: true,
        is_active: true,
        sort_order: 2
      },
      {
        name: 'Dishwasher, Range & Oven Diagnostic',
        description: '[pricing:diagnostic_fee] In-depth diagnosis for igniters, heating coils, control boards, spray arms, or door latch mechanisms.',
        duration_minutes: 45,
        price: 89,
        requires_address: true,
        is_active: true,
        sort_order: 3
      }
    ],
    templates: {
      auto_reply: "Hello from {business_name}! We are on an active appliance repair call and missed your ring. Need fast service? Schedule a diagnostic visit here: {booking_url}",
      after_hours: "Thanks for reaching out to {business_name}! Our technicians are off for the evening. You can lock in a diagnostic arrival window for tomorrow right here: {booking_url}",
      busy: "Hi, this is {business_name}! We're currently troubleshooting an appliance on-site. Pick your preferred service time directly: {booking_url}"
    }
  },

  painting: {
    id: 'painting',
    name: 'Painting & Drywall',
    icon: 'Paintbrush',
    badge: 'Paint & Drywall',
    description: 'Interior and exterior residential painting, cabinet refinishing, and drywall finish.',
    services: [
      {
        name: 'Interior Room Painting Consultation',
        description: '[pricing:free_estimate] In-person wall inspection, square footage measurement, sheen/color consultation, and written proposal.',
        duration_minutes: 45,
        price: 0,
        requires_address: true,
        is_active: true,
        sort_order: 1
      },
      {
        name: 'Interior Single Room Repaint',
        description: '[pricing:quote_on_site] Prep, minor spackling, trim masking, and 2 coats of premium latex paint on walls and doors. Exact quote provided on site.',
        duration_minutes: 240,
        price: null,
        requires_address: true,
        is_active: true,
        sort_order: 2
      },
      {
        name: 'Exterior Siding & Trim Paint Estimate',
        description: '[pricing:free_estimate] Exterior surface inspection, power wash prep plan, caulking assessment, and complete exterior paint estimate.',
        duration_minutes: 60,
        price: 0,
        requires_address: true,
        is_active: true,
        sort_order: 3
      }
    ],
    templates: {
      auto_reply: "Hi! This is {business_name}. We're currently painting and missed your call. To schedule a free painting estimate or consultation, tap here: {booking_url}",
      after_hours: "Thanks for calling {business_name}! Our crew has packed up for the day. You can view open consultation slots and book online at: {booking_url}",
      busy: "Hello from {business_name}! We are reviewing paint plans with a client right now. Pick an appointment time directly at: {booking_url}"
    }
  },

  garage_doors: {
    id: 'garage_doors',
    name: 'Garage Door Repair & Install',
    icon: 'DoorClosed',
    badge: 'Garage Doors',
    description: 'Torsion spring replacement, opener repair, cable realignment, and new overhead doors.',
    services: [
      {
        name: '25-Point Garage Door Tune-Up & Safety Check',
        description: '[pricing:fixed] Complete lubrication of rollers and hinges, torsion spring balance testing, track alignment, and safety sensor test.',
        duration_minutes: 45,
        price: 79,
        requires_address: true,
        is_active: true,
        sort_order: 1
      },
      {
        name: 'Broken Torsion Spring Replacement',
        description: '[pricing:quote_on_site] Remove snapped spring, install heavy-duty high-cycle torsion spring, re-tension cables, and test balance.',
        duration_minutes: 60,
        price: null,
        requires_address: true,
        is_active: true,
        sort_order: 2
      },
      {
        name: 'Garage Door Opener Installation & Repair',
        description: '[pricing:starting_at] Diagnostic, repair, or full installation of belt/chain drive openers, keypad setup, and safety sensors.',
        duration_minutes: 90,
        price: 185,
        requires_address: true,
        is_active: true,
        sort_order: 3
      }
    ],
    templates: {
      auto_reply: "Hi from {business_name}! We're on a service truck fixing a garage door and missed you. Need urgent repair or a tune-up? Book here: {booking_url}",
      after_hours: "Thanks for contacting {business_name}! Our overhead door crew is off for the evening. Schedule priority morning repair service at: {booking_url}",
      busy: "Hello! This is {business_name}. Our technicians are on a service call. Reserve an open garage door repair slot directly: {booking_url}"
    }
  },

  locksmith: {
    id: 'locksmith',
    name: 'Locksmith & Security',
    icon: 'Key',
    badge: 'Locks & Keys',
    description: 'Residential lockout service, rekeying, deadbolt upgrades, and electronic smart locks.',
    services: [
      {
        name: 'Emergency Residential Lockout Service',
        description: '[pricing:fixed] Non-destructive entry into home, front door pick/bypass, and latch hardware safety verification.',
        duration_minutes: 30,
        price: 95,
        requires_address: true,
        is_active: true,
        sort_order: 1
      },
      {
        name: 'Whole-Home Rekey & Key Duplicate Package',
        description: '[pricing:starting_at] Rekey up to 4 lock cylinders, match all deadbolts to a single master key, and provide 2 cut duplicate keys.',
        duration_minutes: 60,
        price: 135,
        requires_address: true,
        is_active: true,
        sort_order: 2
      },
      {
        name: 'Smart Lock & Keypad Deadbolt Installation',
        description: '[pricing:quote_on_site] Removal of existing deadbolt, door jamb strike plate alignment, smart lock installation, and app programming.',
        duration_minutes: 45,
        price: null,
        requires_address: true,
        is_active: true,
        sort_order: 3
      }
    ],
    templates: {
      auto_reply: "Hi! This is {business_name}. We're on an emergency lockout call and missed you. Need immediate locksmith help? Book an arrival window here: {booking_url}",
      after_hours: "Thanks for reaching {business_name}! If this is an after-hours lockout or rekey request, please view open slots online at: {booking_url}",
      busy: "Hello from {business_name}! We're currently rekeying locks for a homeowner. Choose your service time right here: {booking_url}"
    }
  },

  pressure_washing: {
    id: 'pressure_washing',
    name: 'Pressure Washing & Exterior Cleaning',
    icon: 'Waves',
    badge: 'Power Wash',
    description: 'Driveway power washing, soft wash house siding, deck restoration, and concrete cleaning.',
    services: [
      {
        name: 'Driveway, Sidewalk & Walkway Surface Wash',
        description: '[pricing:starting_at] Rotary surface cleaner deep pressure washing to remove tire marks, oil grime, and algae from concrete pads.',
        duration_minutes: 75,
        price: 149,
        requires_address: true,
        is_active: true,
        sort_order: 1
      },
      {
        name: 'Whole-Home Siding Soft Wash',
        description: '[pricing:quote_on_site] Low-pressure chemical surfactant wash to kill green mildew, organic growth, and spider webs on exterior siding.',
        duration_minutes: 120,
        price: null,
        requires_address: true,
        is_active: true,
        sort_order: 2
      },
      {
        name: 'Deck & Patio Wood/Paver Deep Cleaning',
        description: '[pricing:quote_on_site] Targeted chemical wash and pressure rinse for wooden decks, composite boards, or stone paver patios.',
        duration_minutes: 90,
        price: null,
        requires_address: true,
        is_active: true,
        sort_order: 3
      }
    ],
    templates: {
      auto_reply: "Hi! This is {business_name}. Our pressure washers are running and we couldn't hear the ring. To schedule an exterior wash or quote, tap here: {booking_url}",
      after_hours: "Thanks for calling {business_name}! Our power wash rig is parked for the evening. You can book an exterior clean or estimate at: {booking_url}",
      busy: "Hey from {business_name}! We're currently washing a property. Choose your preferred service time directly at: {booking_url}"
    }
  },

  carpet_cleaning: {
    id: 'carpet_cleaning',
    name: 'Carpet, Tile & Upholstery Cleaning',
    icon: 'Sparkles',
    badge: 'Carpet & Tile',
    description: 'Hot water steam extraction, tile and grout scrubbing, upholstery, and pet odor treatment.',
    services: [
      {
        name: 'Multi-Room Carpet Steam Extraction',
        description: '[pricing:starting_at] Truck-mounted hot water extraction, pre-spray traffic lanes, fiber agitation, and fast-dry vacuum rinse.',
        duration_minutes: 90,
        price: 139,
        requires_address: true,
        is_active: true,
        sort_order: 1
      },
      {
        name: 'Tile & Grout Deep Rotary Scrub',
        description: '[pricing:quote_on_site] Alkaline soil pre-treatment, high-pressure rotary enclosed tile scrub, and dirty water extraction.',
        duration_minutes: 90,
        price: null,
        requires_address: true,
        is_active: true,
        sort_order: 2
      },
      {
        name: 'Pet Stain & Enzymatic Odor Treatment',
        description: '[pricing:starting_at] Sub-surface urine extraction, deep fiber enzyme rinse, and odor neutralizing sanitization.',
        duration_minutes: 60,
        price: 79,
        requires_address: true,
        is_active: true,
        sort_order: 3
      }
    ],
    templates: {
      auto_reply: "Hello! This is {business_name}. We're running our steam extraction units and missed your call. Book your carpet or tile clean here: {booking_url}",
      after_hours: "Thanks for calling {business_name}! Our office is closed for the evening. Check open dates and book your cleaning directly: {booking_url}",
      busy: "Hi, this is {business_name}! We're currently cleaning carpets for a client. Lock in your service window at: {booking_url}"
    }
  },

  tree_service: {
    id: 'tree_service',
    name: 'Tree Service & Arborist',
    icon: 'Trees',
    badge: 'Tree Service',
    description: 'Tree trimming, hazardous removal, stump grinding, canopy thinning, and emergency storm branch clearing.',
    services: [
      {
        name: 'On-Site Tree Hazard & Trimming Assessment',
        description: '[pricing:free_estimate] Certified arborist walk-through to assess tree health, overhead power line clearance, and provide a written estimate.',
        duration_minutes: 45,
        price: 0,
        requires_address: true,
        is_active: true,
        sort_order: 1
      },
      {
        name: 'Canopy Thinning & Deadwood Trimming',
        description: '[pricing:quote_on_site] Professional rope-climbing or bucket truck pruning to remove hazardous limbs, balance weight, and improve sunlight.',
        duration_minutes: 180,
        price: null,
        requires_address: true,
        is_active: true,
        sort_order: 2
      },
      {
        name: 'Tree Removal & Stump Grinding Service',
        description: '[pricing:quote_on_site] Complete sectional takedown of designated tree, wood chipping, stump grinding below grade, and yard cleanup.',
        duration_minutes: 240,
        price: null,
        requires_address: true,
        is_active: true,
        sort_order: 3
      }
    ],
    templates: {
      auto_reply: "Hi! This is {business_name}. We're up in a bucket truck or operating chainsaws and missed you. Need tree work? Book an arborist consultation here: {booking_url}",
      after_hours: "Thanks for calling {business_name}! Our tree crew has packed up for the day. You can request a tree inspection or estimate 24/7 at: {booking_url}",
      busy: "Hello from {business_name}! We are currently on a tree job site. Choose your preferred estimate window right here: {booking_url}"
    }
  },

  fencing_decking: {
    id: 'fencing_decking',
    name: 'Fencing & Decking',
    icon: 'Fence',
    badge: 'Fence & Deck',
    description: 'Privacy fence installation, post replacement, deck building, board repairs, and staining.',
    services: [
      {
        name: 'New Fence or Deck On-Site Consultation',
        description: '[pricing:free_estimate] In-person property line walk-through, material options (cedar, pine, vinyl, composite), and written estimate.',
        duration_minutes: 45,
        price: 0,
        requires_address: true,
        is_active: true,
        sort_order: 1
      },
      {
        name: 'Fence Post & Gate Repair Visit',
        description: '[pricing:starting_at] Concrete dig-out and replacement of rotted wooden posts, hinge adjustment, and gate latch realignment.',
        duration_minutes: 90,
        price: 165,
        requires_address: true,
        is_active: true,
        sort_order: 2
      },
      {
        name: 'Deck Pressure Wash & Protective Staining',
        description: '[pricing:quote_on_site] Deep wood cleaner wash, mold mitigation, light sanding, and 2 coats of penetrating exterior oil stain.',
        duration_minutes: 180,
        price: null,
        requires_address: true,
        is_active: true,
        sort_order: 3
      }
    ],
    templates: {
      auto_reply: "Hi from {business_name}! We're on a job site building fencing and missed your call. To schedule an on-site estimate or repair, book here: {booking_url}",
      after_hours: "Thanks for reaching {business_name}! Our fence & deck builders are off for the night. You can book a consultation slot at: {booking_url}",
      busy: "Hello! This is {business_name}. Our builders are on-site framing. Pick your appointment time directly at: {booking_url}"
    }
  },

  general_contracting: {
    id: 'general_contracting',
    name: 'Remodeling & General Contracting',
    icon: 'Hammer',
    badge: 'Remodeling',
    description: 'Kitchen renovations, bathroom remodels, basement finishing, additions, and full-home improvements.',
    services: [
      {
        name: 'Bathroom Remodel On-Site Consultation',
        description: '[pricing:free_estimate] In-person review of layout, plumbing relocation, tile work, vanity options, and detailed written budget estimate.',
        duration_minutes: 60,
        price: 0,
        requires_address: true,
        is_active: true,
        sort_order: 1
      },
      {
        name: 'Kitchen Renovation Walkthrough & Planning',
        description: '[pricing:free_estimate] Comprehensive walk-through of cabinetry, countertops, electrical requirements, and project scope planning.',
        duration_minutes: 60,
        price: 0,
        requires_address: true,
        is_active: true,
        sort_order: 2
      },
      {
        name: 'Basement Finishing or Addition Consultation',
        description: '[pricing:free_estimate] Framing, egress window evaluation, insulation, and full general contracting scope estimate.',
        duration_minutes: 60,
        price: 0,
        requires_address: true,
        is_active: true,
        sort_order: 3
      }
    ],
    templates: {
      auto_reply: "Hello! This is {business_name}. We're on a renovation job site and missed your call. Looking to discuss a remodel? Schedule your consultation here: {booking_url}",
      after_hours: "Thanks for contacting {business_name}! Our office is closed for the evening. Feel free to book a project estimate appointment at: {booking_url}",
      busy: "Hi, this is {business_name}! We're currently meeting with homeowners or inspecting a site. Reserve a consultation directly: {booking_url}"
    }
  },

  pool_maintenance: {
    id: 'pool_maintenance',
    name: 'Pool & Spa Service',
    icon: 'Droplets',
    badge: 'Pool & Spa',
    description: 'Weekly pool cleaning, chemical balancing, filter sand changes, and pump repair.',
    services: [
      {
        name: 'Standard Weekly Pool Cleaning & Chemical Balance',
        description: '[pricing:starting_at] Surface skimming, tile line brushing, vacuuming, skimmer basket empty, water testing, and balancing chemicals.',
        duration_minutes: 45,
        price: 75,
        requires_address: true,
        is_active: true,
        sort_order: 1
      },
      {
        name: 'Pool Equipment & Pump Diagnostic',
        description: '[pricing:diagnostic_fee] Full inspection of variable-speed pump, plumbing leaks, filter pressure, salt cell, or heater failures.',
        duration_minutes: 45,
        price: 89,
        requires_address: true,
        is_active: true,
        sort_order: 2
      },
      {
        name: 'Filter Deep Clean & Cartridge Degreasing',
        description: '[pricing:fixed] Complete teardown of DE or cartridge filter grid, chemical pressure wash degreasing, and reassembly.',
        duration_minutes: 60,
        price: 135,
        requires_address: true,
        is_active: true,
        sort_order: 3
      }
    ],
    templates: {
      auto_reply: "Hi! This is {business_name}. We're out servicing pools and missed your call. Need pool service or repairs? Book a visit here: {booking_url}",
      after_hours: "Thanks for calling {business_name}! We are closed for the evening. You can schedule pool maintenance or equipment checks at: {booking_url}",
      busy: "Hello from {business_name}! Our technicians are currently on a pool route. Reserve an appointment window directly: {booking_url}"
    }
  },

  window_services: {
    id: 'window_services',
    name: 'Window & Glass Repair',
    icon: 'Home',
    badge: 'Glass & Window',
    description: 'Fogged glass replacement, window rescreening, balance repair, and replacement windows.',
    services: [
      {
        name: 'Window Measurement & Glass Replacement Quote',
        description: '[pricing:free_estimate] In-person measurement of failed dual-pane fogged glass or broken panes with an exact written proposal.',
        duration_minutes: 45,
        price: 0,
        requires_address: true,
        is_active: true,
        sort_order: 1
      },
      {
        name: 'Window Screen Repair & Mesh Replacement',
        description: '[pricing:starting_at] On-site rescreening of damaged fiberglass or pet-resistant mesh and frame corner repairs.',
        duration_minutes: 45,
        price: 45,
        requires_address: true,
        is_active: true,
        sort_order: 2
      },
      {
        name: 'Dual-Pane Insulated Glass Unit Replacement',
        description: '[pricing:quote_on_site] Removal of failed seal glass unit, installation of new argon-filled insulated glass, and weatherstripping.',
        duration_minutes: 60,
        price: null,
        requires_address: true,
        is_active: true,
        sort_order: 3
      }
    ],
    templates: {
      auto_reply: "Hi! This is {business_name}. We're installing glass on a job and missed your call. Need window or screen service? Pick a time here: {booking_url}",
      after_hours: "Thanks for calling {business_name}! We are closed for the evening, but you can book a window estimate online anytime: {booking_url}",
      busy: "Hello from {business_name}! Our glass specialists are currently assisting a homeowner. Reserve an appointment directly at: {booking_url}"
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
        description: '[pricing:fixed] Hand foam bath, wheels and tires dressed, interior blowout, vacuum, dashboard wipe, and glass cleaned.',
        duration_minutes: 75,
        price: 120,
        requires_address: true,
        is_active: true,
        sort_order: 1
      },
      {
        name: 'Full Signature Detail & Carpet Shampoo',
        description: '[pricing:starting_at] Exterior clay bar and wax, hot water carpet and seat extraction, leather conditioning, and odor treatment.',
        duration_minutes: 150,
        price: 240,
        requires_address: true,
        is_active: true,
        sort_order: 2
      },
      {
        name: 'Mobile Vehicle Diagnostic & Brake Check',
        description: '[pricing:diagnostic_fee] OBD2 computer scan, brake pad and rotor wear assessment, battery/alternator test, and mobile repair estimate.',
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

  general: {
    id: 'general',
    name: 'General & Professional Services',
    icon: 'Briefcase',
    badge: 'Services & Consult',
    description: 'Consulting, pet care, tutoring, wellness, photography, or any independent service provider.',
    services: [
      {
        name: 'Initial Consultation & Needs Assessment',
        description: '[pricing:free_estimate] Introductory consultation to evaluate your project, answer questions, and provide a customized service plan.',
        duration_minutes: 45,
        price: 0,
        requires_address: false,
        is_active: true,
        sort_order: 1
      },
      {
        name: 'Standard Service Appointment',
        description: '[pricing:fixed] One hour standard on-site or virtual service appointment tailored to your individual requirements.',
        duration_minutes: 60,
        price: 85,
        requires_address: true,
        is_active: true,
        sort_order: 2
      },
      {
        name: 'Custom Service Scope & Quote on Site',
        description: '[pricing:quote_on_site] Comprehensive on-site service delivery, project milestone assessment, or custom quote block.',
        duration_minutes: 120,
        price: null,
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
