import { z } from 'zod';

// CEO → Line Manager invitation. Role is fixed server-side (LINE_MANAGER);
// investors are invited to projects by Line Managers instead.
export const createUserSchema = z.object({
  email: z.string().email('Valid email is required'),
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
});

export type CreateUserFormValues = z.infer<typeof createUserSchema>;
