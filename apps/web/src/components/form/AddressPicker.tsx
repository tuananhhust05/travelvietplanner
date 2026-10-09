'use client';

import { useEffect, useState } from 'react';
import { Select } from '@/components/ui/input';
import { api } from '@/lib/api';
import type { Locale } from '@/lib/i18n';

export interface AddressValue {
  province: string;
  commune: string;
}

export interface ParsedAddress extends AddressValue {
  /** Số nhà / đường — phần không suy ra được từ dữ liệu ranh giới. */
  street: string;
}

interface AddressPickerProps {
  value: AddressValue;
  onChange: (next: AddressValue) => void;
  locale?: Locale;
  idPrefix?: string;
}

/**
 * Cascading tỉnh/thành phố -> xã/phường picker backed by our admin_boundaries
 * data. Replaces free-text location entry so stored addresses are always real
 * administrative units.
 */
export function AddressPicker({
  value,
  onChange,
  locale = 'vi',
  idPrefix = 'addr',
}: AddressPickerProps) {
  const [provinces, setProvinces] = useState<string[]>([]);
  const [communes, setCommunes] = useState<string[]>([]);
  const [loadingCommunes, setLoadingCommunes] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api
      .listProvinces()
      .then((r) => {
        if (active) setProvinces(r.items);
      })
      .catch(() => {
        if (active) {
          setError(
            locale === 'vi'
              ? 'Không tải được danh sách tỉnh/thành phố.'
              : 'Could not load provinces.',
          );
        }
      });
    return () => {
      active = false;
    };
  }, [locale]);

  useEffect(() => {
    if (!value.province) {
      setCommunes([]);
      return;
    }
    let active = true;
    setLoadingCommunes(true);
    api
      .listCommunes(value.province)
      .then((r) => {
        if (active) setCommunes(r.items);
      })
      .catch(() => {
        if (active) setCommunes([]);
      })
      .finally(() => {
        if (active) setLoadingCommunes(false);
      });
    return () => {
      active = false;
    };
  }, [value.province]);

  const provinceLabel = locale === 'vi' ? 'Tỉnh / Thành phố' : 'Province / City';
  const communeLabel = locale === 'vi' ? 'Xã / Phường' : 'Commune / Ward';

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <label htmlFor={`${idPrefix}-province`} className="text-sm font-medium text-text">
          {provinceLabel}
        </label>
        <Select
          id={`${idPrefix}-province`}
          value={value.province}
          onChange={(e) => onChange({ province: e.target.value, commune: '' })}
        >
          <option value="">
            {locale === 'vi' ? '-- Chọn tỉnh / thành phố --' : '-- Select province --'}
          </option>
          {provinces.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1.5">
        <label htmlFor={`${idPrefix}-commune`} className="text-sm font-medium text-text">
          {communeLabel}
        </label>
        <Select
          id={`${idPrefix}-commune`}
          value={value.commune}
          disabled={!value.province || loadingCommunes}
          onChange={(e) => onChange({ province: value.province, commune: e.target.value })}
        >
          <option value="">
            {!value.province
              ? locale === 'vi'
                ? '-- Chọn tỉnh trước --'
                : '-- Select a province first --'
              : loadingCommunes
                ? locale === 'vi'
                  ? 'Đang tải…'
                  : 'Loading…'
                : locale === 'vi'
                  ? '-- Chọn xã / phường --'
                  : '-- Select commune --'}
          </option>
          {communes.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </div>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/** Canonical display label for a selected address. */
export function addressValueLabel(v: AddressValue): string {
  if (!v.province || !v.commune) return '';
  return `${v.commune}, ${v.province}`;
}

const PROVINCE_PREFIXES = ['Tỉnh ', 'Thành phố '];
const COMMUNE_PREFIXES = ['Xã ', 'Phường ', 'Đặc khu '];

/**
 * Inverse of `addressValueLabel`: splits a stored address string back into
 * street / province / commune so an edit form can hydrate the pickers.
 * Values that don't match the canonical shape are kept whole as `street`
 * instead of being dropped.
 */
export function parseAddressString(raw: string): ParsedAddress {
  const whole = (raw ?? '').trim();
  const empty: ParsedAddress = { street: whole, province: '', commune: '' };
  if (!whole) return { street: '', province: '', commune: '' };

  const parts = whole.split(', ').map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return empty;

  const province = parts[parts.length - 1];
  const commune = parts[parts.length - 2];
  if (!PROVINCE_PREFIXES.some((p) => province.startsWith(p))) return empty;
  if (!COMMUNE_PREFIXES.some((p) => commune.startsWith(p))) return empty;

  return { street: parts.slice(0, -2).join(', '), province, commune };
}
