import { z } from 'zod';
import { RoleEnum } from './ticket';

// LoginSchema: Login form ka validation rule (valid email aur minimum 8-char password)
export const LoginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters')
});

// RegisterSchema: Naya account banate waqt validation (Name, Email, Password, Role)
export const RegisterSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: RoleEnum.default('PETITIONER'), // Default role student/petitioner hoga
  department: z.string().optional()     // Officials ke liye department optional hai
});

// AnonymousLookupSchema: Receipt code se ticket track karne ka format (32-byte secret code)
export const AnonymousLookupSchema = z.object({
  receiptSecret: z.string().min(32, 'Receipt secret token must be valid format')
});

// TS CONCEPT (type alias): Frontend me form inputs ko JavaScript object type me map karne ke liye
export type LoginInput = z.infer<typeof LoginSchema>;
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type AnonymousLookupInput = z.infer<typeof AnonymousLookupSchema>;
