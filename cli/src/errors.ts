export interface FormattedError {
  message: string;
  exitCode: number;
}

export function formatError(kind: string, ctx: Record<string, unknown> = {}): FormattedError {
  switch (kind) {
    case 'no-token':
      return { message: 'no token — run `vole authtoken <token>` first', exitCode: 2 };
    case 'bad-token':
      return { message: 'invalid token — run `vole authtoken <token>` to save a new one', exitCode: 2 };
    case 'network':
      return {
        message: `cannot reach ${ctx.server ?? 'server'} — check your network or ~/.vole/config.json`,
        exitCode: 1,
      };
    case 'port-down':
      return { message: `local port ${ctx.port} is not listening`, exitCode: 1 };
    case 'tunnel-rejected':
      return { message: String(ctx.message ?? 'tunnel rejected by server'), exitCode: 1 };
    case 'usage':
      return { message: 'usage error — run `vole --help`', exitCode: 2 };
    default:
      return { message: String(ctx.message ?? kind), exitCode: 1 };
  }
}