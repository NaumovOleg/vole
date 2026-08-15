import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, GetCommand, PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'node:crypto';
import {
  hashPassword,
  verifyPassword,
  signJwt,
  verifyJwt,
  generateToken,
  normalizeIdentifier,
  validateIdentifier,
} from './core';

const sm = new SecretsManagerClient({});
const ddb = new DynamoDBClient({});
const doc = DynamoDBDocumentClient.from(ddb);

const JWT_SECRET_ARN = process.env.JWT_SECRET_ARN!;
const USERS_TABLE = process.env.USERS_TABLE!;
const TOKENS_TABLE = process.env.TOKENS_TABLE!;

let jwtSecretPromise: Promise<string> | undefined;
function getJwtSecret(): Promise<string> {
  if (!jwtSecretPromise) {
    jwtSecretPromise = (async () => {
      const res = await sm.send(new GetSecretValueCommand({ SecretId: JWT_SECRET_ARN }));
      return JSON.parse(res.SecretString ?? '{}').jwt;
    })();
  }
  return jwtSecretPromise;
}

export async function handler(event: any): Promise<any> {
  try {
    const method = event.requestContext?.http?.method;
    const path = (event.requestContext?.http?.path ?? event.rawPath ?? '').split('?')[0];
    const route = `${method} ${path}`;

    switch (route) {
      case 'POST /auth/register':
        return await register(event);
      case 'POST /auth/login':
        return await login(event);
      case 'GET /auth/me':
        return await me(event);
      case 'POST /tokens':
        return await createToken(event);
      case 'GET /tokens':
        return await listTokens(event);
      default:
        if (method === 'DELETE' && path.startsWith('/tokens/')) {
          return await revokeToken(event, path);
        }
        return json(404, { error: 'not found' });
    }
  } catch (err: any) {
    if (err.statusCode) {
      return json(err.statusCode, { error: err.message });
    }
    console.error('handler error', err);
    return json(500, { error: 'internal error' });
  }
}

function json(statusCode: number, body: unknown): any {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function httpError(statusCode: number, message: string): never {
  throw Object.assign(new Error(message), { statusCode });
}

function bodyOf(event: any): any {
  if (!event.body) return {};
  try {
    return JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body);
  } catch {
    httpError(400, 'invalid JSON body');
  }
}

function bearerOf(event: any): string | null {
  const auth = event.headers?.authorization ?? event.headers?.Authorization ?? '';
  return auth.startsWith('Bearer ') ? auth.slice(7) : null;
}

async function requireAuth(event: any): Promise<{ userId: string; identifier: string }> {
  const token = bearerOf(event);
  if (!token) httpError(401, 'unauthorized');
  const payload = await verifyJwt(token, await getJwtSecret()).catch(() => httpError(401, 'unauthorized'));
  return { userId: payload.sub!, identifier: payload.identifier ?? '' };
}

async function userById(userId: string): Promise<any> {
  const res = await doc.send(
    new GetCommand({ TableName: USERS_TABLE, Key: { userId } }),
  );
  return res.Item;
}

async function userByIdentifier(identifier: string): Promise<any> {
  const res = await doc.send(
    new QueryCommand({
      TableName: USERS_TABLE,
      IndexName: 'identifierIndex',
      KeyConditionExpression: '#i = :i',
      ExpressionAttributeNames: { '#i': 'identifier' },
      ExpressionAttributeValues: { ':i': identifier },
      Limit: 1,
    }),
  );
  return res.Items?.[0];
}

async function register(event: any): Promise<any> {
  const { identifier, password } = bodyOf(event);
  if (typeof identifier !== 'string' || !validateIdentifier(identifier)) {
    httpError(400, 'invalid identifier (email or phone)');
  }
  if (typeof password !== 'string' || password.length < 8) {
    httpError(400, 'password must be at least 8 characters');
  }

  const normalized = normalizeIdentifier(identifier);
  if (await userByIdentifier(normalized)) {
    httpError(409, 'already registered');
  }

  const userId = randomUUID();
  await doc.send(
    new PutCommand({
      TableName: USERS_TABLE,
      Item: {
        userId,
        identifier: normalized,
        passwordHash: hashPassword(password),
        createdAt: Date.now(),
        blocked: false,
      },
    }),
  );
  return json(201, { userId, identifier: normalized });
}

async function login(event: any): Promise<any> {
  const { identifier, password } = bodyOf(event);
  if (typeof identifier !== 'string' || typeof password !== 'string') {
    httpError(400, 'identifier and password required');
  }

  const normalized = normalizeIdentifier(identifier);
  const user = await userByIdentifier(normalized);
  if (!user || user.blocked || !verifyPassword(password, user.passwordHash)) {
    httpError(401, 'invalid credentials');
  }

  const secret = await getJwtSecret();
  const token = await signJwt({ sub: user.userId, identifier: user.identifier }, secret, { expiresInSec: 86400 });
  return json(200, { token, expiresIn: 86400, userId: user.userId });
}

async function me(event: any): Promise<any> {
  const auth = await requireAuth(event);
  const user = await userById(auth.userId);
  if (!user) httpError(401, 'unauthorized');
  return json(200, { userId: user.userId, identifier: user.identifier });
}

async function createToken(event: any): Promise<any> {
  const auth = await requireAuth(event);
  const { raw, hash } = generateToken();
  const tokenId = randomUUID();
  await doc.send(
    new PutCommand({
      TableName: TOKENS_TABLE,
      Item: { tokenId, tokenHash: hash, userId: auth.userId, createdAt: Date.now() },
    }),
  );
  return json(201, { tokenId, token: raw });
}

async function listTokens(event: any): Promise<any> {
  const auth = await requireAuth(event);
  const res = await doc.send(
    new QueryCommand({
      TableName: TOKENS_TABLE,
      IndexName: 'userIdIndex',
      KeyConditionExpression: '#u = :u',
      ExpressionAttributeNames: { '#u': 'userId' },
      ExpressionAttributeValues: { ':u': auth.userId },
    }),
  );
  const tokens = (res.Items ?? []).map((t) => ({ tokenId: t.tokenId, createdAt: t.createdAt }));
  return json(200, { tokens });
}

async function revokeToken(event: any, path: string): Promise<any> {
  const auth = await requireAuth(event);
  const tokenId = path.slice('/tokens/'.length);
  if (!tokenId) httpError(400, 'tokenId required');

  const res = await doc.send(new GetCommand({ TableName: TOKENS_TABLE, Key: { tokenId } }));
  if (!res.Item) httpError(404, 'token not found');
  if (res.Item.userId !== auth.userId) httpError(403, 'forbidden');

  await doc.send(new DeleteCommand({ TableName: TOKENS_TABLE, Key: { tokenId } }));
  return json(204, {});
}
