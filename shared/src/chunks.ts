export const CHUNK_SIZE = 90 * 1024;

export function splitBody(bodyB64: string): string[] {
  if (!bodyB64) return [];
  const buf = Buffer.from(bodyB64, 'base64');
  if (buf.length <= CHUNK_SIZE) return [bodyB64];
  const chunks: string[] = [];
  for (let offset = 0; offset < buf.length; offset += CHUNK_SIZE) {
    chunks.push(buf.subarray(offset, offset + CHUNK_SIZE).toString('base64'));
  }
  return chunks;
}

export function assembleBody(chunks: string[]): string {
  if (chunks.length === 0) return '';
  return chunks.join('');
}
