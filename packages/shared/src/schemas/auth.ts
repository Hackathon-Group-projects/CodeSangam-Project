import { z } from 'zod';
import { RoleEnum } from './ticket';

export const LoginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters')
});

export const RegisterSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: RoleEnum.default('PETITIONER'),
  department: z.string().optional()
});

export const AnonymousLookupSchema = z.object({
  receiptSecret: z.string().min(32, 'Receipt secret token must be valid format')
});

export type LoginInput = z.infer<typeof LoginSchema>;
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type AnonymousLookupInput = z.infer<typeof AnonymousLookupSchema>;
