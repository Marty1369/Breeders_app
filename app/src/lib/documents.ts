import type { Dog, DocType, Litter, Owner, Puppy, Space } from './types';

export const DOC_TYPE_LABEL: Record<DocType, string> = {
  sale_lt: 'Sale contract (LT)',
  sale_en: 'Sale contract (EN)',
  coown: 'Co-ownership contract',
  export: 'Export contract',
  mating: 'Mating contract',
};

// ---------------------------------------------------------------------------
// Document field mapping — SINGLE SOURCE OF TRUTH for autofill.
//
// Every document field the kennel's forms need (sale/co-own/export/mating
// contracts today; VŠMB litter-notification, pedigree-order and export-cert
// forms later) is declared once here with a `resolve` that derives its value
// from the record graph (space + litter + dam + sire + puppy + owner). New
// document types pick the field keys they need from this catalog; nothing has
// to re-implement the record→field wiring.
//
// Groups are informational (for UI sectioning); `required` drives the
// missing-fields gate. Adding a field here makes it available for autofill
// without touching the generator.
// ---------------------------------------------------------------------------

export interface DocFieldContext {
  space: Space | null;
  litter: Litter | null;
  dam: Dog | null;
  sire: Dog | null;
  puppy: Puppy | null;
  owner: Owner | null;
  /** Puppies of the litter — used by litter-level VŠMB forms (counts). */
  litterPuppies: Puppy[];
}

export type DocFieldGroup = 'kennel' | 'litter' | 'dam' | 'sire' | 'puppy' | 'owner' | 'export';

export interface DocFieldDef {
  key: string;
  label: string;
  group: DocFieldGroup;
  required: boolean;
  resolve: (c: DocFieldContext) => string;
}

const s = (v: string | number | null | undefined): string => (v == null ? '' : String(v));
const litterWhelpingDate = (l: Litter | null): string =>
  l?.dates?.whelping?.actual || l?.dates?.whelping?.predicted || '';

/** The full catalog. Order within a group is the display order. */
export const DOC_FIELD_CATALOG: DocFieldDef[] = [
  // --- Kennel / breeder ---
  { key: 'kennelName', label: 'Kennel name', group: 'kennel', required: true, resolve: (c) => c.space?.kennel_name || c.space?.name || '' },
  { key: 'breederName', label: 'Breeder name', group: 'kennel', required: true, resolve: (c) => s(c.space?.breeder_name) },
  { key: 'breederAddress', label: 'Breeder address', group: 'kennel', required: true, resolve: (c) => s(c.space?.breeder_address) },
  { key: 'breederPhone', label: 'Breeder phone', group: 'kennel', required: false, resolve: (c) => s(c.space?.breeder_phone) },
  { key: 'breederEmail', label: 'Breeder email', group: 'kennel', required: false, resolve: (c) => s(c.space?.breeder_email) },
  { key: 'club', label: 'Club', group: 'kennel', required: false, resolve: (c) => s(c.space?.club) },
  { key: 'vmvtNo', label: 'VMVT approval no.', group: 'kennel', required: false, resolve: (c) => s(c.space?.vmvt_no) },

  // --- Litter ---
  { key: 'litterName', label: 'Litter name', group: 'litter', required: false, resolve: (c) => s(c.litter?.name) },
  { key: 'litterBreed', label: 'Breed', group: 'litter', required: false, resolve: (c) => c.litter?.breed || c.dam?.breed || '' },
  { key: 'litterBirthDate', label: 'Litter birth date', group: 'litter', required: false, resolve: (c) => litterWhelpingDate(c.litter) },
  { key: 'malesCount', label: 'Males', group: 'litter', required: false, resolve: (c) => String(c.litterPuppies.filter((p) => p.sex === 'male').length) },
  { key: 'femalesCount', label: 'Females', group: 'litter', required: false, resolve: (c) => String(c.litterPuppies.filter((p) => p.sex === 'female').length) },

  // --- Dam ---
  { key: 'damName', label: 'Dam', group: 'dam', required: true, resolve: (c) => s(c.dam?.name) },
  { key: 'damRegNo', label: 'Dam registration no.', group: 'dam', required: true, resolve: (c) => s(c.dam?.reg_no) },
  { key: 'damRegistry', label: 'Dam registry', group: 'dam', required: false, resolve: (c) => s(c.dam?.registry) },
  { key: 'damColor', label: 'Dam color', group: 'dam', required: false, resolve: (c) => s(c.dam?.color) },
  { key: 'damTitles', label: 'Dam titles', group: 'dam', required: false, resolve: (c) => s(c.dam?.titles) },
  { key: 'damHealthTests', label: 'Dam health tests', group: 'dam', required: false, resolve: (c) => s(c.dam?.genetics_notes) },
  { key: 'damShowResults', label: 'Dam show results', group: 'dam', required: false, resolve: (c) => s(c.dam?.show_results) },
  { key: 'damWorkingTests', label: 'Dam working tests', group: 'dam', required: false, resolve: (c) => s(c.dam?.working_tests) },
  { key: 'damFaults', label: 'Dam faults / notes', group: 'dam', required: false, resolve: (c) => s(c.dam?.faults) },

  // --- Sire ---
  { key: 'sireName', label: 'Sire', group: 'sire', required: true, resolve: (c) => s(c.sire?.name) },
  { key: 'sireRegNo', label: 'Sire registration no.', group: 'sire', required: false, resolve: (c) => s(c.sire?.reg_no) },
  { key: 'sireRegistry', label: 'Sire registry', group: 'sire', required: false, resolve: (c) => s(c.sire?.registry) },
  { key: 'sireColor', label: 'Sire color', group: 'sire', required: false, resolve: (c) => s(c.sire?.color) },
  { key: 'sireTitles', label: 'Sire titles', group: 'sire', required: false, resolve: (c) => s(c.sire?.titles) },
  { key: 'sireHealthTests', label: 'Sire health tests', group: 'sire', required: false, resolve: (c) => s(c.sire?.genetics_notes) },
  { key: 'sireShowResults', label: 'Sire show results', group: 'sire', required: false, resolve: (c) => s(c.sire?.show_results) },
  { key: 'sireWorkingTests', label: 'Sire working tests', group: 'sire', required: false, resolve: (c) => s(c.sire?.working_tests) },
  { key: 'sireFaults', label: 'Sire faults / notes', group: 'sire', required: false, resolve: (c) => s(c.sire?.faults) },

  // --- Puppy ---
  { key: 'puppyName', label: 'Puppy name', group: 'puppy', required: true, resolve: (c) => s(c.puppy?.name) },
  { key: 'puppySex', label: 'Sex', group: 'puppy', required: true, resolve: (c) => s(c.puppy?.sex) },
  { key: 'puppyColor', label: 'Color', group: 'puppy', required: false, resolve: (c) => s(c.puppy?.color) },
  { key: 'puppyCollar', label: 'Collar color', group: 'puppy', required: false, resolve: (c) => s(c.puppy?.collar_color) },
  { key: 'puppyMarkings', label: 'Markings', group: 'puppy', required: false, resolve: (c) => s(c.puppy?.markings) },
  { key: 'puppyTail', label: 'Tail', group: 'puppy', required: false, resolve: (c) => s(c.puppy?.tail) },
  { key: 'puppyChipNo', label: 'Chip no.', group: 'puppy', required: true, resolve: (c) => s(c.puppy?.chip_no) },
  { key: 'puppyRegNo', label: 'Registration no.', group: 'puppy', required: false, resolve: (c) => s(c.puppy?.reg_no) },
  { key: 'puppyBirthWeight', label: 'Birth weight (g)', group: 'puppy', required: false, resolve: (c) => s(c.puppy?.birth_weight) },
  { key: 'puppyBirthDate', label: 'Birth date', group: 'puppy', required: false, resolve: (c) => (c.puppy?.birth_date_time ? c.puppy.birth_date_time.slice(0, 10) : litterWhelpingDate(c.litter)) },
  { key: 'puppyPrice', label: 'Puppy price (€)', group: 'puppy', required: false, resolve: (c) => s(c.puppy?.price) },

  // --- Owner / buyer ---
  { key: 'ownerName', label: 'Owner name', group: 'owner', required: true, resolve: (c) => s(c.owner?.name) },
  { key: 'ownerFirstName', label: 'Owner first name', group: 'owner', required: false, resolve: (c) => s(c.owner?.first_name) },
  { key: 'ownerSurname', label: 'Owner surname', group: 'owner', required: false, resolve: (c) => s(c.owner?.surname) },
  { key: 'ownerStreet', label: 'Street, house no.', group: 'owner', required: false, resolve: (c) => s(c.owner?.street) },
  { key: 'ownerCity', label: 'City / postal code', group: 'owner', required: false, resolve: (c) => [c.owner?.city, c.owner?.postal_code].filter(Boolean).join(', ') },
  { key: 'ownerPostalCode', label: 'Postal code', group: 'owner', required: false, resolve: (c) => s(c.owner?.postal_code) },
  { key: 'ownerAddress', label: 'Owner address', group: 'owner', required: true, resolve: (c) => c.owner?.address || [c.owner?.street, c.owner?.city, c.owner?.postal_code, c.owner?.country].filter(Boolean).join(', ') },
  { key: 'ownerPhone', label: 'Owner phone', group: 'owner', required: false, resolve: (c) => s(c.owner?.phone) },
  { key: 'ownerEmail', label: 'Owner email', group: 'owner', required: false, resolve: (c) => s(c.owner?.email) },
  { key: 'ownerCountry', label: 'Country', group: 'owner', required: false, resolve: (c) => s(c.owner?.country) },
  // Price prefers the per-puppy price (kennel prices per puppy), falling back to the owner's agreed full price.
  { key: 'price', label: 'Full price (€)', group: 'owner', required: true, resolve: (c) => (c.puppy?.price != null ? String(c.puppy.price) : c.owner?.full_price ? String(c.owner.full_price) : '') },
  { key: 'handoverDate', label: 'Handover date', group: 'owner', required: true, resolve: (c) => s(c.owner?.handover_date) },

  // --- Export destination ---
  { key: 'destinationCountry', label: 'Destination country', group: 'export', required: true, resolve: (c) => s(c.owner?.country) },
  { key: 'destinationAddress', label: 'Destination address', group: 'export', required: true, resolve: (c) => [c.owner?.street, c.owner?.city, c.owner?.postal_code].filter(Boolean).join(', ') || s(c.owner?.address) },
];

const CATALOG_BY_KEY = new Map(DOC_FIELD_CATALOG.map((f) => [f.key, f]));

// Which catalog fields each document TYPE surfaces. Kept identical to the
// original per-type field sets so existing contract generation is unchanged;
// the new catalog fields above are available for autofill / future doc types.
const BASE_KEYS = ['kennelName', 'breederName', 'breederAddress', 'damName', 'damRegNo', 'sireName', 'sireRegNo'];
const PUPPY_KEYS = ['puppyName', 'puppySex', 'puppyColor', 'puppyChipNo', 'puppyRegNo'];
const OWNER_KEYS = ['ownerName', 'ownerAddress', 'ownerPhone', 'price', 'handoverDate'];
const EXPORT_KEYS = ['destinationCountry', 'destinationAddress'];

function fieldKeysFor(type: DocType): string[] {
  if (type === 'mating') return BASE_KEYS;
  if (type === 'export') return [...BASE_KEYS, ...PUPPY_KEYS, ...OWNER_KEYS, ...EXPORT_KEYS];
  return [...BASE_KEYS, ...PUPPY_KEYS, ...OWNER_KEYS];
}

export type FieldDef = Pick<DocFieldDef, 'key' | 'label' | 'required'>;

export function fieldDefsFor(type: DocType): FieldDef[] {
  return fieldKeysFor(type).map((k) => {
    const f = CATALOG_BY_KEY.get(k)!;
    return { key: f.key, label: f.label, required: f.required };
  });
}

/** Autofill: resolve every field in the catalog from the record graph. */
export function resolveAllDocFields(ctx: DocFieldContext): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of DOC_FIELD_CATALOG) out[f.key] = f.resolve(ctx);
  return out;
}

export function buildFieldValues(
  type: DocType,
  space: Space | null,
  litter: Litter | null,
  dam: Dog | null,
  sire: Dog | null,
  puppy: Puppy | null,
  owner: Owner | null,
  litterPuppies: Puppy[] = []
): Record<string, string> {
  const ctx: DocFieldContext = { space, litter, dam, sire, puppy, owner, litterPuppies };
  const v: Record<string, string> = {};
  for (const key of fieldKeysFor(type)) v[key] = CATALOG_BY_KEY.get(key)!.resolve(ctx);
  return v;
}

export function missingFields(type: DocType, values: Record<string, string>): string[] {
  return fieldDefsFor(type)
    .filter((f) => f.required && !values[f.key]?.trim())
    .map((f) => f.key);
}

export function fieldLabel(key: string): string {
  return CATALOG_BY_KEY.get(key)?.label ?? key;
}
