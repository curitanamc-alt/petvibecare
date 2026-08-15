// Shared pet-species vocabulary. The values must match the DB CHECK
// constraint (server/schema.sql + migrations) exactly.
export const SPECIES = [
  { value: 'dog', label: 'Dog', emoji: '🐶', color: 'teal' },
  { value: 'cat', label: 'Cat', emoji: '🐱', color: 'amber' },
  { value: 'rabbit', label: 'Rabbit', emoji: '🐰', color: 'teal' },
  { value: 'guinea_pig', label: 'Guinea Pig', emoji: '🐹', color: 'amber' },
  { value: 'rat', label: 'Fancy Rat', emoji: '🐀', color: 'gray' },
  { value: 'bird', label: 'Bird', emoji: '🐦', color: 'teal' },
  { value: 'pig', label: 'Pig', emoji: '🐷', color: 'amber' },
  { value: 'other', label: 'Other', emoji: '🐾', color: 'gray' },
]

export const speciesLabel = (v) => SPECIES.find((s) => s.value === v)?.label || v || '—'
export const speciesEmoji = (v) => SPECIES.find((s) => s.value === v)?.emoji || '🐾'
export const speciesColor = (v) => SPECIES.find((s) => s.value === v)?.color || 'gray'

// Species groups used by the admin filters (Services / Customer Pets).
export const SPECIES_GROUPS = [
  { key: 'dog', label: 'Dogs', match: (sp) => sp === 'dog' },
  { key: 'cat', label: 'Cats', match: (sp) => sp === 'cat' },
  { key: 'rabbit', label: 'Rabbits', match: (sp) => sp === 'rabbit' },
  { key: 'guinea_pig', label: 'Guinea pigs', match: (sp) => sp === 'guinea_pig' },
  { key: 'rat', label: 'Rats', match: (sp) => sp === 'rat' },
  { key: 'bird', label: 'Birds', match: (sp) => sp === 'bird' },
  { key: 'pig', label: 'Pigs', match: (sp) => sp === 'pig' },
  { key: 'other', label: 'Other', match: (sp) => !['dog', 'cat', 'rabbit', 'guinea_pig', 'rat', 'bird', 'pig'].includes(sp) },
]

// Service weight_tier values → which species the service suits.
const DOG_TIERS = ['small', 'medium', 'large', 'xl', 'xxl', 'xxxl']
export const tierSpecies = (tier) => {
  if (!tier || tier === 'any') return 'any'
  if (DOG_TIERS.includes(tier)) return 'dog'
  return tier
}
export const tierLabel = (tier) => {
  if (!tier || tier === 'any') return 'Any pet'
  if (DOG_TIERS.includes(tier)) return 'Dog'
  return speciesLabel(tier)
}
export const isDogTier = (tier) => tier === 'dog' || DOG_TIERS.includes(tier)
