import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { parse } from 'dotenv';

const globalState = globalThis as typeof globalThis & {
  __yosemEnvPreloaded?: boolean;
};

function applyEnvFile(filePath: string, originalEnvKeys: Set<string>) {
  if (!existsSync(filePath)) {
    return;
  }

  const parsed = parse(readFileSync(filePath));
  for (const [key, value] of Object.entries(parsed)) {
    if (originalEnvKeys.has(key)) {
      continue;
    }
    process.env[key] = value;
  }
}

if (!globalState.__yosemEnvPreloaded && process.env.NODE_ENV !== 'test') {
  const originalEnvKeys = new Set(Object.keys(process.env));
  const cwd = process.cwd();

  applyEnvFile(resolve(cwd, '.env'), originalEnvKeys);
  applyEnvFile(resolve(cwd, '.env.local'), originalEnvKeys);

  globalState.__yosemEnvPreloaded = true;
}
