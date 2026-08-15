import { runAuthtoken } from './commands/authtoken.js';
import { runHttp } from './commands/http.js';

const command = process.argv[2];
const args = process.argv.slice(3);

switch (command) {
  case 'authtoken':
    runAuthtoken(args);
    break;
  case 'http':
    runHttp(args);
    break;
  case undefined:
  case 'help':
  case '--help':
  case '-h':
    printUsage();
    break;
  default:
    console.error(`unknown command: ${command}`);
    printUsage();
    process.exit(2);
}

function printUsage(): void {
  console.log(`vole — self-hosted tunnel client

Usage:
  vole authtoken <token> [wss-server-url]   save your API token
  vole http <port>                           open an HTTP tunnel to a local server

Examples:
  vole authtoken vole_abc123 wss://xxxx.execute-api.us-east-1.amazonaws.com/dev
  vole http 3000`);
}
