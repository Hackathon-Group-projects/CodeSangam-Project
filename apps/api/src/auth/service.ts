import argon2 from 'argon2';
import { SignJWT, jwtVerify } from 'jose';
import { RoleEnum } from '@vishanti/shared';
import { config } from '../config';
import { ApiError } from '../errors';

const jwtSecret = new TextEncoder().encode(config.jwtSecret);

export interface AuthenticatedUser {
  id: string;
  role: string;
  tier: number;
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return argon2.verify(passwordHash, password);
}

export async function createAccessToken(user: AuthenticatedUser): Promise<string> {
  return new SignJWT({ role: user.role, tier: user.tier })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(user.id)
    .setIssuer('vishanti-api')
    .setAudience('vishanti-web')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(jwtSecret);
}

export async function readBearerToken(header?: string): Promise<AuthenticatedUser | null> {
  if (!header) return null;

  const match = /^Bearer\s+(\S+)$/i.exec(header);
  if (!match) throw new ApiError(401, 'Authorization must use a Bearer token');

  try {
    const { payload } = await jwtVerify(match[1], jwtSecret, {
      algorithms: ['HS256'],
      issuer: 'vishanti-api',
      audience: 'vishanti-web'
    });
    const role = RoleEnum.safeParse(payload.role);

    if (
      typeof payload.sub !== 'string' ||
      !role.success ||
      typeof payload.tier !== 'number' ||
      !Number.isInteger(payload.tier)
    ) {
      throw new Error('Invalid token claims');
    }

    return { id: payload.sub, role: role.data, tier: payload.tier };
  } catch {
    throw new ApiError(401, 'Bearer token is invalid or expired');
  }
}
