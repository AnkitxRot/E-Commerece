import { z } from 'zod';

const addressFieldsSchema = z.object({
  label: z.string().trim().min(1).max(50),
  line1: z.string().trim().min(1).max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().min(1).max(100),
  postalCode: z.string().trim().min(3).max(20),
  country: z.string().trim().min(1).max(100),
  phone: z.string().trim().min(6).max(20),
});

// isDefault is accepted at create time as a convenience ("make this my
// default while adding it"), but NOT on the general update endpoint —
// changing an existing address's default status is a dedicated,
// transactionally-atomic operation (see addresses.service.ts#setDefault),
// not an incidental side effect of an unrelated field edit.
export const createAddressInputSchema = addressFieldsSchema
  .extend({ isDefault: z.boolean().optional() })
  .strict();
export type CreateAddressInput = z.infer<typeof createAddressInputSchema>;

export const updateAddressInputSchema = addressFieldsSchema.partial().strict();
export type UpdateAddressInput = z.infer<typeof updateAddressInputSchema>;

export const addressDtoSchema = z
  .object({
    id: z.string().uuid(),
    label: z.string(),
    line1: z.string(),
    line2: z.string().nullable(),
    city: z.string(),
    state: z.string(),
    postalCode: z.string(),
    country: z.string(),
    phone: z.string(),
    isDefault: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .strict();
export type AddressDto = z.infer<typeof addressDtoSchema>;

export const addressListResponseSchema = z.object({ addresses: z.array(addressDtoSchema) }).strict();
export type AddressListResponse = z.infer<typeof addressListResponseSchema>;

export const addressResponseSchema = z.object({ address: addressDtoSchema }).strict();
export type AddressResponse = z.infer<typeof addressResponseSchema>;
