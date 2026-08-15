import { describe, test, expect } from 'bun:test';
import { parseCommand } from './repl';

describe('parseCommand', () => {
  test('opens tunnels from kind + port', () => {
    expect(parseCommand('http 3000')).toEqual({ action: 'open', kind: 'http', port: 3000 });
    expect(parseCommand('  tcp 5000 ')).toEqual({ action: 'open', kind: 'tcp', port: 5000 });
    expect(parseCommand('ws 8080')).toEqual({ action: 'open', kind: 'ws', port: 8080 });
  });

  test('stop by port', () => {
    expect(parseCommand('stop 3000')).toEqual({ action: 'stop', port: 3000 });
  });

  test('list/exit/help keywords', () => {
    expect(parseCommand('list').action).toBe('list');
    expect(parseCommand('ls').action).toBe('list');
    expect(parseCommand('quit').action).toBe('exit');
    expect(parseCommand('q').action).toBe('exit');
    expect(parseCommand('help').action).toBe('help');
  });

  test('invalid input falls back to help', () => {
    expect(parseCommand('http')).toEqual({ action: 'help' });
    expect(parseCommand('http abc')).toEqual({ action: 'help' });
    expect(parseCommand('http 99999')).toEqual({ action: 'help' });
    expect(parseCommand('stop')).toEqual({ action: 'help' });
    expect(parseCommand('banana 42')).toEqual({ action: 'help' });
  });

  test('empty line is a no-op', () => {
    expect(parseCommand('')).toEqual({ action: 'none' });
    expect(parseCommand('   ')).toEqual({ action: 'none' });
  });
});