import { homedir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';

export interface VoleConfig {
  token?: string;
  server?: string;
}

const DIR = join(homedir(), '.vole');
const FILE = join(DIR, 'config.json');

export function loadConfig(): VoleConfig {
  if (!existsSync(FILE)) return {};
  try {
    return JSON.parse(readFileSync(FILE, 'utf8'));
  } catch {
    return {};
  }
}

export function saveConfig(partial: Partial<VoleConfig>): VoleConfig {
  const merged = { ...loadConfig(), ...partial };
  mkdirSync(DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify(merged, null, 2), { mode: 0o600 });
  return merged;
}
