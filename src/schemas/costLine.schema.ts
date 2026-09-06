import { z } from 'zod';

const optionalPositiveQty = z.preprocess(
  (val) => (val === '' || val === null || val === undefined ? undefined : val),
  z.coerce.number().positive('Quantity must be greater than zero'),
);

const optionalNonNegCost = z.preprocess(
  (val) => (val === '' || val === null || val === undefined ? undefined : val),
  z.coerce.number().min(0, 'Unit cost cannot be negative'),
);

const optionalFreq = z.preprocess(
  (val) => (val === '' || val === null || val === undefined ? undefined : val),
  z.coerce.number().int().min(1).max(365).optional(),
);

/** Unrefined object so .partial() stays legal in Zod 4. */
export const costLineObject = z.object({
  occurredOn: z.string().min(8, 'Date is required'),
  description: z.string().trim().min(2, 'Description is required').max(200),
  class: z.enum(['CAPEX', 'OPEX']),
  nature: z.enum(['ONE_TIME', 'RECURRING']),
  quantity: optionalPositiveQty,
  unitCostNaira: optionalNonNegCost,
  annualFrequency: optionalFreq,
});

export const costLineSchema = costLineObject.superRefine((data, ctx) => {
  if (data.nature === 'ONE_TIME' && data.annualFrequency != null && data.annualFrequency !== 1) {
    ctx.addIssue({
      code: 'custom',
      message: 'One-time costs use a frequency of 1.',
      path: ['annualFrequency'],
    });
  }
});

export const updateCostLineSchema = costLineObject.partial();

export type CostLineFormValues = z.infer<typeof costLineObject>;
