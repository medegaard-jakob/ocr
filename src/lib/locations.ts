/**
 * Where a task runs from and to.
 *
 * A place is one of five kinds, and how you pick it depends on the kind:
 * stands are typed on a keypad because a large airport has hundreds of them,
 * banks and the two storage types are short lists, and "Other" is whatever
 * the four named kinds don't cover.
 *
 * The lists below stand in for backend configuration. Every screen renders
 * whatever this hands it, in the order given, so swapping these for a real
 * fetch changes no UI -- the names are not baked into any component.
 */

export type LocationType = 'stand' | 'bank' | 'full_storage' | 'empty_storage' | 'other';

/** Display order on the type picker. */
export const LOCATION_TYPES: LocationType[] = [
  'stand',
  'bank',
  'full_storage',
  'empty_storage',
  'other',
];

export const LOCATION_TYPE_LABELS: Record<LocationType, string> = {
  stand: 'Stands',
  bank: 'Banks',
  full_storage: 'Full ULD Storage',
  empty_storage: 'Empty ULD Storage',
  other: 'Other',
};

/** The one-line hint beside each type on the picker. */
export const LOCATION_TYPE_HINTS: Record<LocationType, string> = {
  stand: 'type the number',
  bank: 'set in backend',
  full_storage: 'set in backend',
  empty_storage: 'set in backend',
  other: 'type a place',
};

export interface LocationConfig {
  /** Stand prefixes, e.g. A-D. The number after it is typed, not listed. */
  standLetters: string[];
  banks: string[];
  fullStorageAreas: string[];
  emptyStorageAreas: string[];
}

// Placeholder for what a backend would serve. Compass names because that's
// how a ramp refers to its corners; a real deployment replaces the lot.
export const MOCK_LOCATION_CONFIG: LocationConfig = {
  standLetters: ['A', 'B', 'C', 'D'],
  banks: ['Bank 1', 'Bank 2', 'Bank 3'],
  fullStorageAreas: ['East', 'West', 'North', 'South', 'Central'],
  emptyStorageAreas: ['East', 'West', 'North', 'South', 'Central'],
};

/** The places inside a type, or null for the two that aren't a list. */
export function placesForType(type: LocationType, config: LocationConfig): string[] | null {
  switch (type) {
    case 'bank':
      return config.banks;
    case 'full_storage':
      return config.fullStorageAreas;
    case 'empty_storage':
      return config.emptyStorageAreas;
    case 'stand':
    case 'other':
      return null;
  }
}

/**
 * How a place reads once picked. Bank names already carry their own word
 * ("Bank 2"), and a typed place is whatever was typed, so only stands and
 * the storage areas get their type spelled out in front of them -- "West"
 * alone would say nothing on a task card.
 */
export function formatLocation(type: LocationType, place: string): string {
  switch (type) {
    case 'stand':
      return `Stand ${place}`;
    case 'full_storage':
      return `Full ULD Storage · ${place}`;
    case 'empty_storage':
      return `Empty ULD Storage · ${place}`;
    case 'bank':
    case 'other':
      return place;
  }
}
