import { z } from 'zod';

export const payAccountSchema = z.object({
  bankName: z.string().min(2, 'Bank name is required'),
  accountName: z.string().min(2, 'Account name is required'),
  accountNumber: z.string().min(10, 'Account number must be at least 10 characters'),
});

export const durationUnitSchema = z.enum(['DAYS', 'WEEKS', 'MONTHS']);

export const projectBasicsSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  sector: z.string().min(2, 'Sector is required'),
  location: z.string().min(2, 'Location is required'),
  targetAmount: z.coerce.number().positive('Target must be greater than zero'),
  durationValue: z.coerce.number().int().positive('Duration must be greater than zero'),
  durationUnit: durationUnitSchema,
});

export const projectDetailsSchema = z.object({
  summary: z.string().min(10, 'Summary must be at least 10 characters'),
  fullDetails: z.string().min(10, 'Full details must be at least 10 characters'),
  risks: z.string().min(5, 'Risks are required'),
  timeline: z.string().min(5, 'Timeline is required'),
  bankName: z.string().min(2, 'Bank name is required'),
  accountName: z.string().min(2, 'Account name is required'),
  accountNumber: z.string().min(10, 'Account number must be at least 10 characters'),
  estimatedRoiPct: z.coerce.number().min(0).max(100),
  isPublic: z.boolean().optional(),
  // Human-friendly manager share (0-50%). Converted to
  // profit_split_investor_bps at submit time. Default = 30.
  // Investors must always retain majority (≥ 50%), hence the 50 cap.
  managerSharePct: z.coerce.number().min(0).max(50).default(30),
  exitNoticeDays: z.coerce.number().positive().optional(),
  earlyExitPenaltyBps: z.coerce.number().min(0).max(10000).optional(),
});

export const createProjectSchema = projectBasicsSchema.merge(projectDetailsSchema);

export const updateProjectSchema = createProjectSchema.partial();

export const decideProjectSchema = z.object({
  approvalStatus: z.enum(['APPROVED', 'REJECTED']),
  rejectionNote: z.string().optional(),
});

export const inviteInvestorSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  maxAmountNaira: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : val),
    z.coerce.number().positive('Max amount must be greater than zero').optional(),
  ),
});

export type PayAccountFormValues = z.infer<typeof payAccountSchema>;
export type ProjectBasicsFormValues = z.infer<typeof projectBasicsSchema>;
export type ProjectDetailsFormValues = z.infer<typeof projectDetailsSchema>;
export type CreateProjectFormValues = z.infer<typeof createProjectSchema>;
export type InviteInvestorFormValues = z.infer<typeof inviteInvestorSchema>;
