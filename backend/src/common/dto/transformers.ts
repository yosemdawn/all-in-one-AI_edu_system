import { Transform } from 'class-transformer';
import type { TransformFnParams } from 'class-transformer';

const trimStringValue = (value: unknown): unknown =>
  typeof value === 'string' ? value.trim() : value;

export const ToBoolean = () =>
  Transform(({ value }: TransformFnParams): unknown => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true' || normalized === '1') {
        return true;
      }
      if (normalized === 'false' || normalized === '0') {
        return false;
      }
    }
    return value;
  });

export const ToNumber = () =>
  Transform(({ value }: TransformFnParams): unknown => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : value;
  });

export const ToStringArray = () =>
  Transform(({ value }: TransformFnParams): unknown => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    if (Array.isArray(value)) {
      return value.map((item) => String(item).trim()).filter(Boolean);
    }
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }
    return value;
  });

export const TrimString = () =>
  Transform(({ value }: TransformFnParams): unknown => trimStringValue(value));

export const ToOptionalString = (sentinels: string[] = []) =>
  Transform(({ value }: TransformFnParams): unknown => {
    if (value === undefined || value === null) {
      return undefined;
    }
    if (typeof value !== 'string') {
      return value;
    }

    const normalized = value.trim();
    if (!normalized || sentinels.includes(normalized)) {
      return undefined;
    }

    return normalized;
  });
