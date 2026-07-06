import { z } from 'zod';

export const commitInvestmentSchema = z.object({
  amountKobo: z.number().min(10000, 'Minimum investment is ₦100'),
});

export const submitProofSchema = z.object({
  proofName: z.string().min(1, 'Please provide a proof reference'),
});

export type CommitInvestmentFormValues = z.infer<typeof commitInvestmentSchema>;
export type SubmitProofFormValues = z.infer<typeof submitProofSchema>;
