import type { FastifyInstance } from 'fastify';
import argon2 from 'argon2';
import { LoginSchema, RegisterSchema } from '@vishanti/shared';
import { prisma } from '../db';
import { ApiError } from '../errors';
import { createAccessToken, hashPassword, verifyPassword } from './service';

function isDuplicateEmail(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

function publicUser(user: { id: string; name: string | null; email: string | null; role: string; tier: number }) {
  return { id: user.id, name: user.name, email: user.email, role: user.role, tier: user.tier };
}

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/auth/register', async (request, reply) => {
    const parsed = RegisterSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ success: false, message: 'Invalid registration details', errors: parsed.error.issues });
    }

    const input = parsed.data;
    try {
      const user = await prisma.user.create({
        data: {
          name: input.name.trim(),
          email: input.email.trim().toLowerCase(),
          passwordHash: await hashPassword(input.password),
          // Public registration must never allow a caller to create staff/admin accounts.
          role: 'PETITIONER',
          tier: 0
        }
      });
      const token = await createAccessToken(user);

      return reply.code(201).send({ success: true, data: { token, user: publicUser(user) } });
    } catch (error) {
      if (isDuplicateEmail(error)) throw new ApiError(409, 'An account with this email already exists');
      throw error;
    }
  });

  app.post('/api/auth/login', async (request, reply) => {
    const parsed = LoginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ success: false, message: 'Invalid login details', errors: parsed.error.issues });
    }

    const email = parsed.data.email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });
    const passwordMatches = user?.passwordHash
      ? await verifyPassword(parsed.data.password, user.passwordHash)
      : await argon2.hash(parsed.data.password, { type: argon2.argon2id }).then(() => false);

    if (!user || !passwordMatches || !user.passwordHash) {
      throw new ApiError(401, 'Email or password is incorrect');
    }

    const token = await createAccessToken(user);
    return reply.send({ success: true, data: { token, user: publicUser(user) } });
  });
}
