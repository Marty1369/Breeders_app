import type { Dog, DocType, Litter, Owner, Puppy, Space } from './types';

export const DOC_TYPE_LABEL: Record<DocType, string> = {
  sale_lt: 'Sale contract (LT)',
  sale_en: 'Sale contract (EN)',
  coown: 'Co-ownership contract',
  export: 'Export contract',
  mating: 'Mating contract',
};

interface FieldDef {
  key: string;
  label: string;
  required: boolean;
}

const BASE_FIELDS: FieldDef[] = [
  { key: 'kennelName', label: 'Kennel name', required: true },
  { key: 'breederName', label: 'Breeder name', required: true },
  { key: 'breederAddress', label: 'Breeder address', required: true },
  { key: 'damName', label: 'Dam', required: true },
  { key: 'damRegNo', label: 'Dam registration no.', required: true },
  { key: 'sireName', label: 'Sire', required: true },
  { key: 'sireRegNo', label: 'Sire registration no.', required: false },
];

const PUPPY_FIELDS: FieldDef[] = [
  { key: 'puppyName', label: 'Puppy name', required: true },
  { key: 'puppySex', label: 'Sex', required: true },
  { key: 'puppyColor', label: 'Color', required: false },
  { key: 'puppyChipNo', label: 'Chip no.', required: true },
  { key: 'puppyRegNo', label: 'Registration no.', required: false },
];

const OWNER_FIELDS: FieldDef[] = [
  { key: 'ownerName', label: 'Owner name', required: true },
  { key: 'ownerAddress', label: 'Owner address', required: true },
  { key: 'ownerPhone', label: 'Owner phone', required: false },
  { key: 'price', label: 'Full price (€)', required: true },
  { key: 'handoverDate', label: 'Handover date', required: true },
];

const EXPORT_FIELDS: FieldDef[] = [
  { key: 'destinationCountry', label: 'Destination country', required: true },
  { key: 'destinationAddress', label: 'Destination address', required: true },
];

export function fieldDefsFor(type: DocType): FieldDef[] {
  if (type === 'mating') return BASE_FIELDS;
  if (type === 'export') return [...BASE_FIELDS, ...PUPPY_FIELDS, ...OWNER_FIELDS, ...EXPORT_FIELDS];
  return [...BASE_FIELDS, ...PUPPY_FIELDS, ...OWNER_FIELDS];
}

export function buildFieldValues(
  type: DocType,
  space: Space | null,
  litter: Litter | null,
  dam: Dog | null,
  sire: Dog | null,
  puppy: Puppy | null,
  owner: Owner | null
): Record<string, string> {
  const v: Record<string, string> = {
    kennelName: space?.kennel_name || space?.name || '',
    breederName: space?.breeder_name || '',
    breederAddress: space?.breeder_address || '',
    damName: dam?.name || '',
    damRegNo: dam?.reg_no || '',
    sireName: sire?.name || (litter ? '' : ''),
    sireRegNo: sire?.reg_no || '',
  };
  if (type !== 'mating') {
    v.puppyName = puppy?.name || '';
    v.puppySex = puppy?.sex || '';
    v.puppyColor = puppy?.color || '';
    v.puppyChipNo = puppy?.chip_no || '';
    v.puppyRegNo = puppy?.reg_no || '';
    v.ownerName = owner?.name || '';
    v.ownerAddress = owner?.address || '';
    v.ownerPhone = owner?.phone || '';
    v.price = owner?.full_price ? String(owner.full_price) : '';
    v.handoverDate = owner?.handover_date || '';
  }
  if (type === 'export') {
    v.destinationCountry = owner?.country || '';
    v.destinationAddress = '';
  }
  return v;
}

export function missingFields(type: DocType, values: Record<string, string>): string[] {
  return fieldDefsFor(type)
    .filter((f) => f.required && !values[f.key]?.trim())
    .map((f) => f.key);
}

export function fieldLabel(type: DocType, key: string): string {
  return fieldDefsFor(type).find((f) => f.key === key)?.label ?? key;
}
