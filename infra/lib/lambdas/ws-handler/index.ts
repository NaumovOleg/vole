import { randomUUID } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, GetCommand, PutCommand, DeleteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import { hashToken } from '../auth-handler/core';
import { parseFrame, encodeFrame } from '../../../../shared/src/protocol';
import { PROTOCOL_VERSION } from '../../../../shared/src/index';
import { isProxyConnection, classifyDataFrame, forwardBytesToAgent, nextSeq } from './routing';

const ddb = new DynamoDBClient({});
const doc = DynamoDBDocumentClient.from(ddb);

const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE!;
const TOKENS_TABLE = process.env.TOKENS_TABLE!;
const USERS_TABLE = process.env.USERS_TABLE!;
const TUNNELS_TABLE = process.env.TUNNELS_TABLE!;
const LOGS_TABLE = process.env.LOGS_TABLE!;

const TTL_MS = 12 * 3600 * 1000;
const DOMAIN = process.env.DOMAIN ?? 'vole.sh';

const seqByAgent = new Map<string, number>();

export async function handler(event: any): Promise<any> {
  const route = event.requestContext?.routeKey;
  try {
    switch (route) {
      case '$connect':
        return await onConnect(event);
      case '$disconnect':
        return await onDisconnect(event);
      case '$default':
        return await onMessage(event);
      default:
        return { statusCode: 404 };
    }
  } catch (err: any) {
    console.error('ws handler error', route, err);
    return { statusCode: 500 };
  }
}

async function onConnect(event: any): Promise<any> {
  const connectionId = event.requestContext.connectionId;
  const subdomain = event.queryStringParameters?.tunnel;
  if (typeof subdomain === 'string') {
    return await proxyConnect(connectionId, subdomain);
  }

  const token = event.queryStringParameters?.token;
  if (!token || typeof token !== 'string') {
    return { statusCode: 401 };
  }

  const res = await doc.send(
    new QueryCommand({
      TableName: TOKENS_TABLE,
      IndexName: 'tokenHashIndex',
      KeyConditionExpression: '#h = :h',
      ExpressionAttributeNames: { '#h': 'tokenHash' },
      ExpressionAttributeValues: { ':h': hashToken(token) },
      Limit: 1,
    }),
  );
  const tokenRow = res.Items?.[0];
  if (!tokenRow) {
    return { statusCode: 401 };
  }

  const user = await doc.send(new GetCommand({ TableName: USERS_TABLE, Key: { userId: tokenRow.userId } }));
  if (user.Item?.blocked) {
    await doc.send(new DeleteCommand({ TableName: TOKENS_TABLE, Key: { tokenId: tokenRow.tokenId } }));
    return { statusCode: 401 };
  }

  const now = Date.now();
  await doc.send(
    new PutCommand({
      TableName: CONNECTIONS_TABLE,
      Item: {
        connectionId,
        userId: tokenRow.userId,
        tokenHash: tokenRow.tokenHash,
        connectedAt: now,
        lastSeenAt: now,
        expiresAt: now + TTL_MS,
      },
    }),
  );
  console.log('connected', connectionId, tokenRow.userId);
  return { statusCode: 200 };
}

async function proxyConnect(connectionId: string, subdomain: string): Promise<any> {
  const tunnel = await doc.send(new GetCommand({ TableName: TUNNELS_TABLE, Key: { subdomain } }));
  if (!tunnel.Item) {
    return { statusCode: 404 };
  }
  if (tunnel.Item.type === 'http') {
    return { statusCode: 400 };
  }
  const now = Date.now();
  await doc.send(
    new PutCommand({
      TableName: CONNECTIONS_TABLE,
      Item: {
        connectionId,
        role: 'proxy',
        tunnelSubdomain: subdomain,
        connectedAt: now,
        lastSeenAt: now,
        expiresAt: now + TTL_MS,
      },
    }),
  );
  await doc.send(
    new UpdateCommand({
      TableName: TUNNELS_TABLE,
      Key: { subdomain },
      UpdateExpression: 'SET proxyConnectionId = :pid',
      ExpressionAttributeValues: { ':pid': connectionId },
    }),
  );
  console.log('proxy connected', connectionId, subdomain);
  return { statusCode: 200 };
}

async function onDisconnect(event: any): Promise<any> {
  const connectionId = event.requestContext.connectionId;
  const conn = await doc.send(new GetCommand({ TableName: CONNECTIONS_TABLE, Key: { connectionId } }));
  await doc.send(new DeleteCommand({ TableName: CONNECTIONS_TABLE, Key: { connectionId } }));
  const connRow: any = conn.Item;
  if (connRow?.userId) {
    await cleanupTunnels(connRow.userId, connectionId);
  }
  if (isProxyConnection(connRow) && connRow.tunnelSubdomain) {
    await clearProxyConnection(connRow.tunnelSubdomain, connectionId);
  }
  console.log('disconnected', connectionId);
  return { statusCode: 200 };
}

async function clearProxyConnection(subdomain: string, connectionId: string): Promise<void> {
  try {
    await doc.send(
      new UpdateCommand({
        TableName: TUNNELS_TABLE,
        Key: { subdomain },
        UpdateExpression: 'REMOVE proxyConnectionId',
        ConditionExpression: 'proxyConnectionId = :pid',
        ExpressionAttributeValues: { ':pid': connectionId },
      }),
    );
  } catch (err: any) {
    if (err?.name !== 'ConditionalCheckFailedException') throw err;
  }
}

async function cleanupTunnels(userId: string, connectionId: string): Promise<void> {
  const res = await doc.send(
    new QueryCommand({
      TableName: TUNNELS_TABLE,
      IndexName: 'userIdIndex',
      KeyConditionExpression: '#u = :u',
      ExpressionAttributeNames: { '#u': 'userId' },
      ExpressionAttributeValues: { ':u': userId },
    }),
  );
  for (const tunnel of res.Items ?? []) {
    if (tunnel.connectionId === connectionId) {
      await doc.send(new DeleteCommand({ TableName: TUNNELS_TABLE, Key: { subdomain: tunnel.subdomain } }));
    }
  }
}

async function onMessage(event: any): Promise<any> {
  const connectionId = event.requestContext.connectionId;
  const client = apiClient(event);

  const conn = await doc.send(new GetCommand({ TableName: CONNECTIONS_TABLE, Key: { connectionId } }));
  if (isProxyConnection(conn.Item)) {
    return await proxyMessage(client, connectionId, conn.Item, event);
  }

  let frame: any;
  try {
    frame = parseFrame(event.body ?? '');
  } catch {
    await safePost(client, connectionId, encodeFrame('error', 'malformed', { error: 'invalid frame' }));
    return { statusCode: 200 };
  }

  switch (frame.t) {
    case 'hello':
      if (frame.d?.version !== PROTOCOL_VERSION) {
        await safePost(client, connectionId, encodeFrame('error', frame.id, { error: `unsupported protocol version ${frame.d?.version}` }));
      } else {
        await safePost(client, connectionId, encodeFrame('ready', frame.id));
        await touch(connectionId);
      }
      break;
    case 'ping':
      await safePost(client, connectionId, encodeFrame('pong', frame.id));
      await touch(connectionId);
      break;
    case 'pong':
      await touch(connectionId);
      break;
    case 'tunnel-open':
      await openTunnel(client, connectionId, frame);
      break;
    case 'tunnel-close':
      await closeTunnel(client, connectionId, frame);
      break;
    case 'response':
      await storeResponse(connectionId, frame);
      break;
    case 'data':
      await routeData(client, connectionId, conn.Item, frame);
      break;
    default:
      await safePost(client, connectionId, encodeFrame('error', frame.id, { error: `frame type ${frame.t} not supported yet` }));
  }
  return { statusCode: 200 };
}

async function proxyMessage(client: ApiGatewayManagementApiClient, connectionId: string, connRow: any, event: any): Promise<any> {
  let frame: any;
  try {
    frame = parseFrame(event.body ?? '');
  } catch {
    return await forwardProxyBytes(client, connectionId, connRow, event);
  }
  if (frame.t === 'hello' || frame.t === 'tunnel-open' || frame.t === 'tunnel-close') {
    await safePost(client, connectionId, encodeFrame('error', frame.id, { error: 'protocol violation' }));
    return { statusCode: 200 };
  }
  return await forwardProxyBytes(client, connectionId, connRow, event);
}

async function forwardProxyBytes(client: ApiGatewayManagementApiClient, connectionId: string, connRow: any, event: any): Promise<any> {
  const bytes = Buffer.from(event.body ?? '', event.isBase64Encoded ? 'base64' : 'utf8');
  const tunnel = await doc.send(
    new GetCommand({ TableName: TUNNELS_TABLE, Key: { subdomain: connRow.tunnelSubdomain } }),
  );
  const agentId = forwardBytesToAgent(connRow, tunnel.Item ? [tunnel.Item as any] : []);
  if (!agentId) {
    await safePost(client, connectionId, encodeFrame('error', '0', { error: 'agent not connected' }));
    await doc.send(new DeleteCommand({ TableName: CONNECTIONS_TABLE, Key: { connectionId } }));
    await clearProxyConnection(connRow.tunnelSubdomain, connectionId);
    return { statusCode: 200 };
  }
  const n = nextSeq(seqByAgent.get(agentId) ?? -1);
  seqByAgent.set(agentId, n);
  await safePost(client, agentId, encodeFrame('data', randomUUID(), { n, data: bytes.toString('base64') }));
  await touch(connectionId);
  return { statusCode: 200 };
}

async function routeData(client: ApiGatewayManagementApiClient, connectionId: string, connRow: any, frame: any): Promise<void> {
  let tunnelRow: any;
  if (connRow?.userId) {
    const res = await doc.send(
      new QueryCommand({
        TableName: TUNNELS_TABLE,
        IndexName: 'userIdIndex',
        KeyConditionExpression: '#u = :u',
        ExpressionAttributeNames: { '#u': 'userId' },
        ExpressionAttributeValues: { ':u': connRow.userId },
      }),
    );
    tunnelRow = (res.Items ?? []).find((t) => t.connectionId === connectionId);
  }
  const route = classifyDataFrame(connRow, tunnelRow);
  if (route === 'agent-bytes') {
    await agentBytesToProxy(client, tunnelRow, frame);
  } else if (route === 'http-chunk') {
    await storeChunk(connectionId, frame);
  } else {
    await safePost(client, connectionId, encodeFrame('error', frame.id, { error: 'unexpected data frame' }));
  }
}

async function agentBytesToProxy(client: ApiGatewayManagementApiClient, tunnelRow: any, frame: any): Promise<void> {
  const d = frame.d ?? {};
  if (typeof d.n !== 'number' || typeof d.data !== 'string' || !tunnelRow?.proxyConnectionId) return;
  await safePostBinary(client, tunnelRow.proxyConnectionId, Buffer.from(d.data, 'base64'), async () => {
    await clearProxyConnection(tunnelRow.subdomain, tunnelRow.proxyConnectionId);
  });
}

async function userIdOfConnection(connectionId: string): Promise<string | undefined> {
  const res = await doc.send(new GetCommand({ TableName: CONNECTIONS_TABLE, Key: { connectionId } }));
  return res.Item?.userId;
}

async function openTunnel(client: ApiGatewayManagementApiClient, connectionId: string, frame: any): Promise<void> {
  const userId = await userIdOfConnection(connectionId);
  if (!userId) {
    await safePost(client, connectionId, encodeFrame('error', frame.id, { error: 'connection not registered' }));
    return;
  }
  const type = frame.d?.type;
  const localPort = frame.d?.localPort;
  if (!['http', 'tcp', 'ws'].includes(type) || typeof localPort !== 'number') {
    await safePost(client, connectionId, encodeFrame('error', frame.id, { error: 'invalid tunnel-open payload' }));
    return;
  }

  const existing = await doc.send(
    new QueryCommand({
      TableName: TUNNELS_TABLE,
      IndexName: 'userIdIndex',
      KeyConditionExpression: '#u = :u',
      ExpressionAttributeNames: { '#u': 'userId' },
      ExpressionAttributeValues: { ':u': userId },
    }),
  );
  if ((existing.Items ?? []).some((t) => t.connectionId === connectionId)) {
    await safePost(client, connectionId, encodeFrame('error', frame.id, { error: 'tunnel already open on this connection' }));
    return;
  }

  const base = `u-${userId.slice(0, 8)}`;
  for (let i = 0; i < 10; i++) {
    const subdomain = i === 0 ? base : `${base}-${i}`;
    try {
      await doc.send(
        new PutCommand({
          TableName: TUNNELS_TABLE,
          Item: {
            subdomain,
            userId,
            connectionId,
            type,
            localPort,
            createdAt: Date.now(),
          },
          ConditionExpression: 'attribute_not_exists(subdomain)',
        }),
      );
      await safePost(
        client,
        connectionId,
        encodeFrame('tunnel-open', frame.id, { subdomain, url: `https://${subdomain}.${DOMAIN}` }),
      );
      return;
    } catch (err: any) {
      if (err?.name === 'ConditionalCheckFailedException') continue;
      throw err;
    }
  }
  await safePost(client, connectionId, encodeFrame('error', frame.id, { error: 'no subdomain slots left' }));
}

async function closeTunnel(client: ApiGatewayManagementApiClient, connectionId: string, frame: any): Promise<void> {
  const subdomain = frame.d?.subdomain;
  if (typeof subdomain !== 'string') {
    await safePost(client, connectionId, encodeFrame('error', frame.id, { error: 'subdomain required' }));
    return;
  }
  const res = await doc.send(new GetCommand({ TableName: TUNNELS_TABLE, Key: { subdomain } }));
  if (!res.Item) {
    await safePost(client, connectionId, encodeFrame('error', frame.id, { error: 'no such tunnel' }));
    return;
  }
  if (res.Item.connectionId !== connectionId) {
    await safePost(client, connectionId, encodeFrame('error', frame.id, { error: 'not your tunnel' }));
    return;
  }
  await doc.send(new DeleteCommand({ TableName: TUNNELS_TABLE, Key: { subdomain } }));
  await safePost(client, connectionId, encodeFrame('tunnel-close', frame.id, { subdomain }));
}

async function storeResponse(connectionId: string, frame: any): Promise<void> {
  const requestId = frame.id;
  const d = frame.d ?? {};
  await doc.send(
    new UpdateCommand({
      TableName: LOGS_TABLE,
      Key: { connectionId, requestId },
      UpdateExpression:
        'SET #s = :s, statusCode = :sc, headers = :h, chunkTotal = :ct, completedAt = :ca, expiresAt = :e' +
        (d.bodyB64 !== undefined ? ', bodyB64 = :b' : ''),
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: {
        ':s': 'done',
        ':sc': d.statusCode ?? 500,
        ':h': d.headers ?? {},
        ':ct': d.chunkTotal ?? 0,
        ':ca': Date.now(),
        ':e': Date.now() + 60_000,
        ...(d.bodyB64 !== undefined ? { ':b': d.bodyB64 } : {}),
      },
    }),
  );
}

async function storeChunk(connectionId: string, frame: any): Promise<void> {
  const d = frame.d ?? {};
  if (typeof d.n !== 'number' || typeof d.data !== 'string') return;
  await doc.send(
    new PutCommand({
      TableName: LOGS_TABLE,
      Item: {
        connectionId,
        requestId: `${frame.id}#${d.n}`,
        data: d.data,
        expiresAt: Date.now() + 60_000,
      },
    }),
  );
}

function apiClient(event: any): ApiGatewayManagementApiClient {
  return new ApiGatewayManagementApiClient({
    region: process.env.AWS_REGION!,
    endpoint: `https://${event.requestContext.domainName}/${event.requestContext.stage}`,
  });
}

async function safePost(client: ApiGatewayManagementApiClient, connectionId: string, message: string): Promise<void> {
  try {
    await client.send(
      new PostToConnectionCommand({ ConnectionId: connectionId, Data: new TextEncoder().encode(message) }),
    );
  } catch (err: any) {
    if (err?.name === 'GoneException') {
      await doc.send(new DeleteCommand({ TableName: CONNECTIONS_TABLE, Key: { connectionId } }));
    } else {
      console.error('postToConnection failed', connectionId, err);
    }
  }
}

async function safePostBinary(client: ApiGatewayManagementApiClient, connectionId: string, data: Uint8Array, onGone: () => Promise<void>): Promise<void> {
  try {
    await client.send(new PostToConnectionCommand({ ConnectionId: connectionId, Data: data }));
  } catch (err: any) {
    if (err?.name === 'GoneException') {
      await onGone();
    } else {
      console.error('postToConnection failed', connectionId, err);
    }
  }
}

async function touch(connectionId: string): Promise<void> {
  const now = Date.now();
  await doc.send(
    new UpdateCommand({
      TableName: CONNECTIONS_TABLE,
      Key: { connectionId },
      UpdateExpression: 'SET lastSeenAt = :now, expiresAt = :exp',
      ExpressionAttributeValues: { ':now': now, ':exp': now + TTL_MS },
    }),
  );
}
