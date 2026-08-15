import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, GetCommand, PutCommand, DeleteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import { hashToken } from '../auth-handler/core';
import { parseFrame, encodeFrame } from '../../../../shared/src/protocol';
import { PROTOCOL_VERSION } from '../../../../shared/src/index';

const ddb = new DynamoDBClient({});
const doc = DynamoDBDocumentClient.from(ddb);

const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE!;
const TOKENS_TABLE = process.env.TOKENS_TABLE!;
const USERS_TABLE = process.env.USERS_TABLE!;
const TUNNELS_TABLE = process.env.TUNNELS_TABLE!;
const LOGS_TABLE = process.env.LOGS_TABLE!;

const TTL_MS = 12 * 3600 * 1000;
const DOMAIN = process.env.DOMAIN ?? 'vole.sh';

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

async function onDisconnect(event: any): Promise<any> {
  const connectionId = event.requestContext.connectionId;
  const conn = await doc.send(new GetCommand({ TableName: CONNECTIONS_TABLE, Key: { connectionId } }));
  await doc.send(new DeleteCommand({ TableName: CONNECTIONS_TABLE, Key: { connectionId } }));
  if (conn.Item?.userId) {
    await cleanupTunnels(conn.Item.userId, connectionId);
  }
  console.log('disconnected', connectionId);
  return { statusCode: 200 };
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
      await storeChunk(connectionId, frame);
      break;
    default:
      await safePost(client, connectionId, encodeFrame('error', frame.id, { error: `frame type ${frame.t} not supported yet` }));
  }
  return { statusCode: 200 };
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
