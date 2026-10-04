export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'greater_than_or_equal'
  | 'less_than'
  | 'less_than_or_equal'
  | 'in'
  | 'not_in'
  | 'contains'

export interface SingleCondition {
  field: string
  operator: ConditionOperator
  value: any
}

export interface RuleConditionsConfig {
  match?: 'all' | 'any'
  rules?: SingleCondition[]
}

/**
 * Extracts a value from a nested object via dot path (e.g. 'lead.urgency', 'payload.hangup_cause')
 */
export function getNestedValue(obj: any, path: string): any {
  if (!obj || typeof obj !== 'object') return undefined
  const parts = path.split('.')
  let current = obj
  for (const part of parts) {
    if (current === undefined || current === null) return undefined
    current = current[part]
  }
  return current
}

/**
 * Evaluates an individual condition against the extracted value
 */
export function evaluateSingleCondition(condition: SingleCondition, data: Record<string, any>): boolean {
  const actualValue = getNestedValue(data, condition.field)
  const targetValue = condition.value

  switch (condition.operator) {
    case 'equals':
      return actualValue === targetValue || String(actualValue) === String(targetValue)

    case 'not_equals':
      return actualValue !== targetValue && String(actualValue) !== String(targetValue)

    case 'greater_than':
      return Number(actualValue) > Number(targetValue)

    case 'greater_than_or_equal':
      return Number(actualValue) >= Number(targetValue)

    case 'less_than':
      return Number(actualValue) < Number(targetValue)

    case 'less_than_or_equal':
      return Number(actualValue) <= Number(targetValue)

    case 'in':
      if (Array.isArray(targetValue)) {
        return targetValue.includes(actualValue)
      }
      return false

    case 'not_in':
      if (Array.isArray(targetValue)) {
        return !targetValue.includes(actualValue)
      }
      return true

    case 'contains':
      if (typeof actualValue === 'string') {
        return actualValue.toLowerCase().includes(String(targetValue).toLowerCase())
      }
      if (Array.isArray(actualValue)) {
        return actualValue.includes(targetValue)
      }
      return false

    default:
      return false
  }
}

/**
 * Evaluates an entire condition set against an event/entity context
 */
export function evaluateConditions(
  config: RuleConditionsConfig | SingleCondition[] | Record<string, any> | undefined | null,
  context: Record<string, any>
): boolean {
  if (!config) return true // No conditions = unconditional trigger

  // Support array format directly
  if (Array.isArray(config)) {
    if (config.length === 0) return true
    return config.every((cond) => evaluateSingleCondition(cond, context))
  }

  // Support key-value equality map format: { "lead.urgency": "emergency" }
  if (!config.rules && typeof config === 'object') {
    const entries = Object.entries(config)
    if (entries.length === 0) return true
    return entries.every(([field, expectedVal]) => {
      const actualVal = getNestedValue(context, field)
      return actualVal === expectedVal || String(actualVal) === String(expectedVal)
    })
  }

  const { match = 'all', rules = [] } = config as RuleConditionsConfig
  if (rules.length === 0) return true

  if (match === 'any') {
    return rules.some((rule) => evaluateSingleCondition(rule, context))
  }

  return rules.every((rule) => evaluateSingleCondition(rule, context))
}
