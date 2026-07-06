import { z } from 'zod';

export const createUserSchema = z.object({
  email: z.string().email('Valid email is required'),
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  role: z.enum(['LINE_MANAGER', 'INVESTOR']),
});

export type CreateUserFormValues = z.infer<typeof createUserSchema>;
