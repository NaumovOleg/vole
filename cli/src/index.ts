import { runAuthtoken } from './commands/authtoken.js';
import { runHttp } from './commands/http.js';
import { runTcp } from './commands/tcp.js';
import { runWs } from './commands/ws.js';

const command = process.argv[2];
const args = process.argv.slice(3);

switch (command) {
  case 'authtoken':
    runAuthtoken(args);
    break;
  case 'http':
    runHttp(args);
    break;
  case 'tcp':
    runTcp(args);
    break;
  case 'ws':
    runWs(args);
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
  vole tcp <port>                            bridge a TCP port to a local server
  vole ws <port>                             proxy WebSocket messages to a local server

Examples:
  vole authtoken vole_abc123 wss://xxxx.execute-api.us-east-1.amazonaws.com/dev
  vole http 3000
  vole tcp 5432
  vole ws 8080`);
}
