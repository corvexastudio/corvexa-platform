/**
 * Service Catalog & Category Classifier Engine
 * Dynamically categorizes service offerings across all home service & trade industries,
 * provides fuzzy search, detects popular anchor services, and organizes catalogs for optimal UX.
 */

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function matchesKeyword(text: string, kw: string): boolean {
  const trimmedKw = kw.trim().toLowerCase()
  if (trimmedKw.length <= 3) {
    const regex = new RegExp(`\\b${escapeRegExp(trimmedKw)}\\b`, 'i')
    return regex.test(text)
  }
  return text.toLowerCase().includes(trimmedKw)
}

function cleanServiceDescription(description?: string | null): string {
  if (!description) return ''
  return description.replace(/\[pricing:(fixed|starting_at|diagnostic_fee|free_estimate|quote_on_site)\]\s*/gi, '').trim()
}

export interface BaseServiceItem {
  id: string
  name: string
  description?: string | null
  duration_minutes: number
  price?: number | null
  requires_address?: boolean
  sort_order?: number
}

export interface ServiceCategory {
  id: string
  label: string
  icon?: string
  count: number
}

export interface CategorizedServiceItem<T extends BaseServiceItem = BaseServiceItem> {
  service: T
  categoryId: string
  categoryLabel: string
  isPopular: boolean
  cleanDesc: string
}

export interface ServiceCatalogResult<T extends BaseServiceItem = BaseServiceItem> {
  categories: ServiceCategory[]
  items: CategorizedServiceItem<T>[]
  totalCount: number
  popularCount: number
  hasCategories: boolean
}

interface CategoryRule {
  id: string
  label: string
  icon?: string
  keywords: string[]
}

const INDUSTRY_TAXONOMY: Record<string, CategoryRule[]> = {
  plumbing: [
    {
      id: 'drains',
      label: 'Drains & Sewers',
      icon: 'Droplet',
      keywords: ['drain', 'sewer', 'rooter', 'clog', 'snake', 'hydro-jet', 'cleanout', 'stack', 'sink clog']
    },
    {
      id: 'water_heaters',
      label: 'Water Heaters',
      icon: 'Flame',
      keywords: ['water heater', 'tankless', 'boiler', 'flush', 'burner', 'element', 'heating element', 'hot water']
    },
    {
      id: 'leaks',
      label: 'Leaks & Diagnostics',
      icon: 'Search',
      keywords: ['leak', 'diagnostic', 'inspection', 'pinpoint', 'burst', 'pipe', 'pressure', 'camera', 'slab']
    },
    {
      id: 'fixtures',
      label: 'Fixtures & Toilets',
      icon: 'Wrench',
      keywords: ['toilet', 'faucet', 'sink', 'shower', 'disposal', 'garbage disposal', 'tub', 'valve', 'repipe', 'cartridge']
    }
  ],

  hvac: [
    {
      id: 'cooling',
      label: 'AC & Cooling',
      icon: 'Snowflake',
      keywords: ['ac', 'air condition', 'cooling', 'refrigerant', 'freon', 'condenser', 'compressor', 'evaporator']
    },
    {
      id: 'heating',
      label: 'Heating & Furnaces',
      icon: 'Flame',
      keywords: ['furnace', 'heating', 'heat pump', 'heat', 'boiler', 'gas line', 'pilot', 'burner']
    },
    {
      id: 'maintenance',
      label: 'Tune-Ups & Filters',
      icon: 'CheckCircle',
      keywords: ['tune-up', 'tuneup', 'maintenance', 'seasonal', 'filter', 'coil', 'efficiency', 'airflow']
    },
    {
      id: 'repairs',
      label: 'Diagnostics & Repairs',
      icon: 'Wrench',
      keywords: ['diagnostic', 'repair', 'emergency', 'breakdown', 'thermostat', 'fan motor', 'capacitor', 'blower']
    }
  ],

  electrical: [
    {
      id: 'diagnostics',
      label: 'Troubleshooting & Diagnostics',
      icon: 'Search',
      keywords: ['diagnostic', 'troubleshoot', 'troubleshooting', 'flicker', 'flickering', 'breaker', 'short', 'tripping', 'inspection', 'safety']
    },
    {
      id: 'fixtures',
      label: 'Lighting & Outlets',
      icon: 'Lightbulb',
      keywords: ['outlet', 'switch', 'fixture', 'lighting', 'fan', 'gfci', 'receptacle', 'dimmer', 'chandelier', 'led']
    },
    {
      id: 'panels',
      label: 'Panels & EV Chargers',
      icon: 'Zap',
      keywords: ['panel', 'charger', 'ev', '200a', 'subpanel', 'generator', 'rewire', 'breaker box', 'load calculation']
    }
  ],

  roofing: [
    {
      id: 'inspections',
      label: 'Inspections & Estimates',
      icon: 'Search',
      keywords: ['inspection', 'estimate', 'assessment', 'storm', 'damage', 'pitch', 'flashing', 'hail']
    },
    {
      id: 'gutters',
      label: 'Gutters & Downspouts',
      icon: 'Droplets',
      keywords: ['gutter', 'downspout', 'leaf', 'seamless', 'flush', 'guard', 'debris']
    },
    {
      id: 'repairs',
      label: 'Repairs & Emergency',
      icon: 'ShieldAlert',
      keywords: ['repair', 'leak', 'tarp', 'patch', 'shingle', 'flashing', 'emergency', 'roof leak']
    }
  ],

  landscaping: [
    {
      id: 'mowing',
      label: 'Mowing & Lawn Care',
      icon: 'Trees',
      keywords: ['mow', 'mowing', 'trim', 'trimming', 'edging', 'turf', 'grass', 'aeration', 'fertiliz']
    },
    {
      id: 'cleanups',
      label: 'Seasonal Cleanups',
      icon: 'Calendar',
      keywords: ['cleanup', 'leaf', 'leaves', 'pruning', 'brush', 'green waste', 'debris', 'fall clean', 'spring clean']
    },
    {
      id: 'mulch',
      label: 'Mulch & Garden Beds',
      icon: 'Flower',
      keywords: ['mulch', 'bed', 'soil', 'sod', 'planting', 'flower', 'gravel', 'trench']
    }
  ],

  cleaning: [
    {
      id: 'standard',
      label: 'Standard Cleaning',
      icon: 'Home',
      keywords: ['standard', 'recurring', 'housekeeping', 'maid', 'dusting', 'mopping', 'vacuum']
    },
    {
      id: 'deep_clean',
      label: 'Deep Clean & Move-In',
      icon: 'Sparkles',
      keywords: ['deep clean', 'move-in', 'move-out', 'turnover', 'airbnb', 'post-construction', 'sanitize']
    },
    {
      id: 'specialty',
      label: 'Specialty Cleaning',
      icon: 'Sparkle',
      keywords: ['carpet', 'window', 'oven', 'refrigerator', 'upholstery', 'sanitation']
    }
  ],

  garage_door: [
    {
      id: 'springs',
      label: 'Springs & Hardware',
      icon: 'Cog',
      keywords: ['spring', 'torsion', 'cable', 'roller', 'drum', 'hinge', 'hardware', 'broken spring']
    },
    {
      id: 'openers',
      label: 'Openers & Motors',
      icon: 'Zap',
      keywords: ['opener', 'motor', 'remote', 'keypad', 'sensor', 'liftmaster', 'belt drive', 'chain drive']
    },
    {
      id: 'repairs',
      label: 'Door Repair & Off-Track',
      icon: 'Wrench',
      keywords: ['off-track', 'track', 'panel', 'replacement', 'weather seal', 'tune-up', 'inspection']
    }
  ],

  pest_control: [
    {
      id: 'insects',
      label: 'General Insect Defense',
      icon: 'Shield',
      keywords: ['insect', 'ant', 'roach', 'cockroach', 'spider', 'wasp', 'perimeter', 'spray']
    },
    {
      id: 'rodents',
      label: 'Rodent & Wildlife Control',
      icon: 'AlertCircle',
      keywords: ['rodent', 'rat', 'mouse', 'mice', 'exclusion', 'attic', 'trap', 'wildlife']
    },
    {
      id: 'specialty',
      label: 'Termite & Specialty',
      icon: 'Bug',
      keywords: ['termite', 'bed bug', 'flea', 'tick', 'mosquito', 'infestation']
    }
  ],

  appliance_repair: [
    {
      id: 'refrigeration',
      label: 'Refrigerators & Freezers',
      icon: 'Snowflake',
      keywords: ['refrigerator', 'fridge', 'freezer', 'ice maker', 'cooling', 'leak']
    },
    {
      id: 'laundry',
      label: 'Washers & Dryers',
      icon: 'Shirt',
      keywords: ['washer', 'dryer', 'laundry', 'spin', 'drain', 'heating element', 'belt']
    },
    {
      id: 'kitchen',
      label: 'Ovens, Ranges & Dishwashers',
      icon: 'Flame',
      keywords: ['oven', 'stove', 'range', 'dishwasher', 'cooktop', 'microwave']
    }
  ]
}

const DEFAULT_FALLBACK_RULES: CategoryRule[] = [
  {
    id: 'diagnostics',
    label: 'Diagnostics & Inspections',
    icon: 'Search',
    keywords: ['diagnostic', 'inspection', 'estimate', 'consultation', 'assessment', 'troubleshoot', 'check', 'audit']
  },
  {
    id: 'repairs',
    label: 'Repairs & Maintenance',
    icon: 'Wrench',
    keywords: ['repair', 'tune-up', 'tuneup', 'service', 'clearing', 'fix', 'flush', 'maintenance', 'emergency']
  },
  {
    id: 'installations',
    label: 'Installs & Replacements',
    icon: 'Plus',
    keywords: ['install', 'installation', 'replacement', 'upgrade', 'assembly', 'repipe', 'remodel']
  }
]

/**
 * Builds an intelligent, categorized service catalog for any industry.
 */
export function buildServiceCatalog<T extends BaseServiceItem = BaseServiceItem>(
  services: T[],
  industry?: string | null
): ServiceCatalogResult<T> {
  const normIndustry = (industry || '').toLowerCase().trim()
  const industryRules = INDUSTRY_TAXONOMY[normIndustry] || DEFAULT_FALLBACK_RULES
  const fallbackRules = normIndustry in INDUSTRY_TAXONOMY ? DEFAULT_FALLBACK_RULES : []

  // Check if any service has explicit [category:...] tags
  const categorized: CategorizedServiceItem<T>[] = services.map((svc, index) => {
    const rawDesc = svc.description || ''
    const cleanDesc = cleanServiceDescription(rawDesc)
    const combinedText = `${svc.name} ${cleanDesc}`.toLowerCase()

    // 1. Explicit tag check: [category:Name]
    const explicitMatch = rawDesc.match(/\[category:([^\]]+)\]/i)
    if (explicitMatch && explicitMatch[1]?.trim()) {
      const explicitLabel = explicitMatch[1].trim()
      const explicitId = explicitLabel.toLowerCase().replace(/[^a-z0-9]+/g, '_')
      const isPopular = determineIsPopular(svc, index, rawDesc, cleanDesc)
      return {
        service: svc,
        categoryId: explicitId,
        categoryLabel: explicitLabel,
        isPopular,
        cleanDesc
      }
    }

    // 2. Industry-specific taxonomy rules
    for (const rule of industryRules) {
      if (rule.keywords.some(kw => matchesKeyword(combinedText, kw))) {
        const isPopular = determineIsPopular(svc, index, rawDesc, cleanDesc)
        return {
          service: svc,
          categoryId: rule.id,
          categoryLabel: rule.label,
          isPopular,
          cleanDesc
        }
      }
    }

    // 3. Fallback general rules
    for (const rule of fallbackRules) {
      if (rule.keywords.some(kw => matchesKeyword(combinedText, kw))) {
        const isPopular = determineIsPopular(svc, index, rawDesc, cleanDesc)
        return {
          service: svc,
          categoryId: rule.id,
          categoryLabel: rule.label,
          isPopular,
          cleanDesc
        }
      }
    }

    // 4. Default bucket
    const isPopular = determineIsPopular(svc, index, rawDesc, cleanDesc)
    return {
      service: svc,
      categoryId: 'general_services',
      categoryLabel: 'General Services',
      isPopular,
      cleanDesc
    }
  })

  // Count items per category
  const categoryCounts = new Map<string, { label: string; count: number; icon?: string }>()
  let popularCount = 0

  categorized.forEach(item => {
    if (item.isPopular) popularCount++
    const existing = categoryCounts.get(item.categoryId)
    if (existing) {
      existing.count++
    } else {
      categoryCounts.set(item.categoryId, {
        label: item.categoryLabel,
        count: 1
      })
    }
  })

  // Build categories array
  const categories: ServiceCategory[] = [
    {
      id: 'all',
      label: `All Services`,
      count: services.length
    }
  ]

  // Add "Popular" filter pill if there are 2+ popular items and total catalog >= 5
  if (popularCount >= 2 && services.length >= 5) {
    categories.push({
      id: 'popular',
      label: '⭐ Most Popular',
      count: popularCount
    })
  }

  // Add individual categories that have items
  categoryCounts.forEach((data, id) => {
    categories.push({
      id,
      label: data.label,
      count: data.count
    })
  })

  // Has categories if more than 1 distinct category exists and total services >= 5
  const distinctCategories = categoryCounts.size
  const hasCategories = distinctCategories > 1 && services.length >= 5

  return {
    categories,
    items: categorized,
    totalCount: services.length,
    popularCount,
    hasCategories
  }
}

/**
 * Determines whether a service is an anchor "Popular" service
 */
function determineIsPopular(
  svc: BaseServiceItem,
  index: number,
  rawDesc: string,
  cleanDesc: string
): boolean {
  if (/\[popular\]/i.test(rawDesc)) return true
  const lowerName = svc.name.toLowerCase()
  const lowerDesc = cleanDesc.toLowerCase()

  // First 2 services are by default popular if sort order <= 2
  if (svc.sort_order !== undefined && svc.sort_order !== null && svc.sort_order <= 2) {
    return true
  }

  // Keywords indicating primary core service / dispatch entry point
  if (
    lowerName.includes('diagnostic') ||
    lowerName.includes('inspection') ||
    lowerName.includes('service call') ||
    lowerName.includes('tune-up') ||
    lowerName.includes('precision tune') ||
    lowerName.includes('emergency') ||
    lowerDesc.includes('credited to repair') ||
    lowerDesc.includes('diagnostic inspection')
  ) {
    return true
  }

  return index < 2
}

/**
 * Filters catalog items by search query and active category
 */
export function filterCatalogItems<T extends BaseServiceItem = BaseServiceItem>(
  items: CategorizedServiceItem<T>[],
  query: string,
  activeCategoryId: string
): CategorizedServiceItem<T>[] {
  const q = query.trim().toLowerCase()

  return items.filter(item => {
    // 1. Category Filter
    if (activeCategoryId === 'popular') {
      if (!item.isPopular) return false
    } else if (activeCategoryId !== 'all' && item.categoryId !== activeCategoryId) {
      return false
    }

    // 2. Keyword Search
    if (!q) return true

    const nameMatch = item.service.name.toLowerCase().includes(q)
    const descMatch = item.cleanDesc.toLowerCase().includes(q)
    const categoryMatch = item.categoryLabel.toLowerCase().includes(q)

    return nameMatch || descMatch || categoryMatch
  })
}
