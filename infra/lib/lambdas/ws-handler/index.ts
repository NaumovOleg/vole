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

const TTL_MS = 12 * 3600 * 1000;

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
  await doc.send(new DeleteCommand({ TableName: CONNECTIONS_TABLE, Key: { connectionId } }));
  console.log('disconnected', connectionId);
  return { statusCode: 200 };
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
    default:
      await safePost(client, connectionId, encodeFrame('error', frame.id, { error: `frame type ${frame.t} not supported yet` }));
  }
  return { statusCode: 200 };
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
