import { loadConfig } from './config.js';

const DEFAULT_SERVER = 'wss://api.vole.free-bert.online/dev';

export function voleServer(): string {
  return loadConfig().server ?? DEFAULT_SERVER;
}

export function voleToken(): string {
  return loadConfig().token ?? '';
}

export function wssHost(): string {
  return voleServer().replace(/^wss?:\/\//, '');
}

export function attachUrl(subdomain: string): string {
  return `wss://${wssHost()}?tunnel=${subdomain}`;
}