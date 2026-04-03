import { Transform } from 'class-transformer';

export const ToBoolean = () =>
  Transform(({ value }) => {
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
  Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : value;
  });

export const ToStringArray = () =>
  Transform(({ value }) => {
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
