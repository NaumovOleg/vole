import { saveConfig } from '../config.js';

export function runAuthtoken(args: string[]): void {
  const token = args[0];
  if (!token) {
    console.error('usage: vole authtoken <token> [wss-server-url]');
    process.exit(2);
  }
  const server = args[1];
  saveConfig({ token, ...(server ? { server } : {}) });
  console.log('Token saved to ~/.vole/config.json');
  if (!token.startsWith('vole_')) {
    console.warn('Warning: token does not look like a vole token (expected vole_...)');
  }
  console.log('Next: run `vole http 3000` to open a tunnel');
}
