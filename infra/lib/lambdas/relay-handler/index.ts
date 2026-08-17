import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, GetCommand, PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import { Readable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { encodeFrame } from '../../../../shared/src/protocol';
import { CHUNK_SIZE, splitBody, assembleBody } from '../../../../shared/src/chunks';

const ddb = new DynamoDBClient({});
const doc = DynamoDBDocumentClient.from(ddb);

const TUNNELS_TABLE = process.env.TUNNELS_TABLE!;
const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE!;
const LOGS_TABLE = process.env.LOGS_TABLE!;

const DOMAIN = process.env.DOMAIN ?? 'vole.free-bert.online';
const MAX_BODY = 10 * 1024 * 1024;
const POLL_INTERVAL_MS = 300;
const POLL_TIMEOUT_MS = 30_000;
const CONNECTION_TTL_MS = 12 * 3600 * 1000;

const HOP_BY_HOP = new Set([
  'host', 'content-length', 'connection', 'transfer-encoding', 'keep-alive',
  'upgrade', 'te', 'trailer', 'proxy-connection', 'expect',
]);

export async function handler(event: any): Promise<any> {
  const method = event.requestContext?.http?.method ?? 'GET';
  const path = event.rawPath ?? '/';
  const query = event.rawQueryString ?? '';

  const host = (event.headers?.host ?? event.headers?.Host ?? '').toLowerCase();
  const subdomain = host.replace(new RegExp(`\\.${DOMAIN.replace(/\./g, '\\.')}$`), '').replace(/^www\./, '');
  if (!subdomain || !/^[a-z0-9][a-z0-9-]*$/.test(subdomain)) {
    return error(400, 'invalid host');
  }

  const tunnel = await doc.send(new GetCommand({ TableName: TUNNELS_TABLE, Key: { subdomain } }));
  if (!tunnel.Item) {
    return error(404, 'no such tunnel');
  }
  const connectionId = tunnel.Item.connectionId;

  const conn = await doc.send(new GetCommand({ TableName: CONNECTIONS_TABLE, Key: { connectionId } }));
  if (!conn.Item) {
    await doc.send(new DeleteCommand({ TableName: TUNNELS_TABLE, Key: { subdomain } }));
    return error(404, 'tunnel offline');
  }

  let body = '';
  if (event.body) {
    if (event.isBase64Encoded) {
      body = event.body;
    } else {
      body = Buffer.from(event.body, 'utf8').toString('base64');
    }
    if (Buffer.from(body, 'base64').length > MAX_BODY) {
      return error(413, 'body too large');
    }
  }

  const id = randomUUID();
  const headers = safeHeaders(event.headers);

  const payload: any = {
    method,
    path,
    ...(query ? { query } : {}),
    headers,
  };

  const chunks = splitBody(body);
  if (chunks.length > 1) {
    payload.chunkTotal = chunks.length;
  } else if (chunks.length === 1) {
    payload.bodyB64 = chunks[0];
  }

  await doc.send(
    new PutCommand({
      TableName: LOGS_TABLE,
      Item: {
        connectionId,
        requestId: id,
        method,
        path,
        status: 'pending',
        createdAt: Date.now(),
        expiresAt: Date.now() + CONNECTION_TTL_MS,
      },
    }),
  );

  const client = apiClient(event);
  try {
    await post(client, connectionId, encodeFrame('request', id, payload));
    for (let n = 0; n < chunks.length; n++) {
      await post(client, connectionId, encodeFrame('data', id, { n, data: chunks[n] }));
    }
  } catch (err: any) {
    if (err?.name === 'GoneException') {
      await doc.send(new DeleteCommand({ TableName: TUNNELS_TABLE, Key: { subdomain } }));
      return error(404, 'tunnel offline');
    }
    throw err;
  }

  const response = await pollResponse(connectionId, id);
  if (!response) {
    return error(504, 'tunnel timeout');
  }

  let bodyB64 = response.bodyB64 ?? '';
  if ((response.chunkTotal ?? 0) > 0) {
    const chunkItems = await doc.send(
      new QueryCommand({
        TableName: LOGS_TABLE,
        KeyConditionExpression: 'connectionId = :c AND begins_with(requestId, :p)',
        ExpressionAttributeValues: { ':c': connectionId, ':p': `${id}#` },
      }),
    );
    const ordered = (chunkItems.Items ?? [])
      .sort((a: any, b: any) => parseInt(a.requestId.split('#')[1], 10) - parseInt(b.requestId.split('#')[1], 10))
      .map((c: any) => c.data);
    bodyB64 = assembleBody(ordered);
    for (const c of chunkItems.Items ?? []) {
      await doc.send(new DeleteCommand({ TableName: LOGS_TABLE, Key: { connectionId, requestId: c.requestId } }));
    }
  }

  await doc.send(new DeleteCommand({ TableName: LOGS_TABLE, Key: { connectionId, requestId: id } }));

  const outHeaders: Record<string, string> = { ...(response.headers ?? {}) };
  delete outHeaders['content-length'];
  delete outHeaders['transfer-encoding'];
  delete outHeaders['connection'];
  delete outHeaders['content-encoding'];
  if (!outHeaders['content-type']) {
    outHeaders['content-type'] = 'text/html; charset=utf-8';
  }
  outHeaders['content-length'] = String(Buffer.from(bodyB64, 'base64').length);

  console.log('relayed', id, subdomain, method, path, response.statusCode);

  if (method === 'HEAD') {
    return { statusCode: response.statusCode ?? 200, headers: outHeaders, body: '' };
  }
  return {
    statusCode: response.statusCode ?? 200,
    headers: outHeaders,
    body: Readable.from([Buffer.from(bodyB64, 'base64')]),
    isBase64Encoded: false,
  };
}

function safeHeaders(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers ?? {})) {
    const key = k.toLowerCase();
    if (HOP_BY_HOP.has(key) || key === 'content-encoding') continue;
    out[key] = v;
  }
  return out;
}

function apiClient(event: any): ApiGatewayManagementApiClient {
  return new ApiGatewayManagementApiClient({
    region: process.env.AWS_REGION!,
    endpoint: `https://${event.requestContext.domainName}/${event.requestContext.stage}`,
  });
}

async function post(client: ApiGatewayManagementApiClient, connectionId: string, message: string): Promise<void> {
  await client.send(
    new PostToConnectionCommand({ ConnectionId: connectionId, Data: new TextEncoder().encode(message) }),
  );
}

async function pollResponse(connectionId: string, requestId: string): Promise<any | null> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const res = await doc.send(new GetCommand({ TableName: LOGS_TABLE, Key: { connectionId, requestId } }));
    if (res.Item?.status === 'done') {
      return res.Item;
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  return null;
}

function error(statusCode: number, message: string): any {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ error: message }),
  };
}
