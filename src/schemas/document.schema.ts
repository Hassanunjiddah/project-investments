import { z } from 'zod';

export const documentMetaSchema = z
  .object({
    kind: z.enum(['OVERVIEW', 'FUND_USE', 'RISK', 'DECISION']),
    title: z.string().min(2, 'Title is required'),
    note: z.string().optional(),
    amountNaira: z.coerce.number().positive().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.kind === 'FUND_USE' && !data.amountNaira) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Amount is required for fund use documents',
        path: ['amountNaira'],
      });
    }
  });

export type DocumentMetaFormValues = z.infer<typeof documentMetaSchema>;
