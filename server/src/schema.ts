import { z } from 'zod';

// User authentication schemas
export const userSchema = z.object({
  id: z.number(),
  username: z.string(),
  email: z.string().email(),
  password_hash: z.string(),
  role: z.enum(['admin', 'manager', 'staff']),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type User = z.infer<typeof userSchema>;

export const loginInputSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
});

export type LoginInput = z.infer<typeof loginInputSchema>;

export const createUserInputSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['admin', 'manager', 'staff'])
});

export type CreateUserInput = z.infer<typeof createUserInputSchema>;

// Category schemas
export const categorySchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Category = z.infer<typeof categorySchema>;

export const createCategoryInputSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().nullable().optional()
});

export type CreateCategoryInput = z.infer<typeof createCategoryInputSchema>;

export const updateCategoryInputSchema = z.object({
  id: z.number(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().nullable().optional()
});

export type UpdateCategoryInput = z.infer<typeof updateCategoryInputSchema>;

// Asset/Item schemas
export const assetStatusEnum = z.enum(['available', 'lent', 'maintenance', 'damaged', 'retired']);

export const assetSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  category_id: z.number(),
  serial_number: z.string().nullable(),
  purchase_date: z.coerce.date().nullable(),
  purchase_price: z.number().nullable(),
  current_value: z.number().nullable(),
  status: assetStatusEnum,
  location: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Asset = z.infer<typeof assetSchema>;

export const createAssetInputSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().nullable().optional(),
  category_id: z.number(),
  serial_number: z.string().nullable().optional(),
  purchase_date: z.coerce.date().nullable().optional(),
  purchase_price: z.number().positive().nullable().optional(),
  current_value: z.number().positive().nullable().optional(),
  status: assetStatusEnum.default('available'),
  location: z.string().nullable().optional()
});

export type CreateAssetInput = z.infer<typeof createAssetInputSchema>;

export const updateAssetInputSchema = z.object({
  id: z.number(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().nullable().optional(),
  category_id: z.number().optional(),
  serial_number: z.string().nullable().optional(),
  purchase_date: z.coerce.date().nullable().optional(),
  purchase_price: z.number().positive().nullable().optional(),
  current_value: z.number().positive().nullable().optional(),
  status: assetStatusEnum.optional(),
  location: z.string().nullable().optional()
});

export type UpdateAssetInput = z.infer<typeof updateAssetInputSchema>;

// Lending schemas
export const lendingStatusEnum = z.enum(['active', 'returned', 'overdue']);

export const lendingSchema = z.object({
  id: z.number(),
  asset_id: z.number(),
  borrower_name: z.string(),
  borrower_email: z.string().nullable(),
  borrower_phone: z.string().nullable(),
  department: z.string().nullable(),
  lent_date: z.coerce.date(),
  expected_return_date: z.coerce.date(),
  actual_return_date: z.coerce.date().nullable(),
  status: lendingStatusEnum,
  notes: z.string().nullable(),
  lent_by_user_id: z.number(),
  returned_by_user_id: z.number().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Lending = z.infer<typeof lendingSchema>;

export const createLendingInputSchema = z.object({
  asset_id: z.number(),
  borrower_name: z.string().min(1).max(100),
  borrower_email: z.string().email().nullable().optional(),
  borrower_phone: z.string().nullable().optional(),
  department: z.string().nullable().optional(),
  expected_return_date: z.coerce.date(),
  notes: z.string().nullable().optional(),
  lent_by_user_id: z.number()
});

export type CreateLendingInput = z.infer<typeof createLendingInputSchema>;

export const returnAssetInputSchema = z.object({
  lending_id: z.number(),
  returned_by_user_id: z.number(),
  return_notes: z.string().nullable().optional(),
  asset_condition: z.enum(['good', 'damaged', 'needs_maintenance']).optional()
});

export type ReturnAssetInput = z.infer<typeof returnAssetInputSchema>;

// Report schemas
export const reportTypeEnum = z.enum(['inventory', 'lending', 'returns', 'overdue', 'category_summary']);

export const generateReportInputSchema = z.object({
  report_type: reportTypeEnum,
  start_date: z.coerce.date().optional(),
  end_date: z.coerce.date().optional(),
  category_id: z.number().optional(),
  status: z.string().optional()
});

export type GenerateReportInput = z.infer<typeof generateReportInputSchema>;

export const reportDataSchema = z.object({
  report_type: reportTypeEnum,
  generated_at: z.coerce.date(),
  parameters: z.record(z.unknown()),
  data: z.array(z.record(z.unknown()))
});

export type ReportData = z.infer<typeof reportDataSchema>;

// Dashboard summary schema
export const dashboardSummarySchema = z.object({
  total_assets: z.number(),
  available_assets: z.number(),
  lent_assets: z.number(),
  overdue_lendings: z.number(),
  assets_in_maintenance: z.number(),
  total_categories: z.number(),
  recent_lendings: z.array(lendingSchema).max(5),
  recent_returns: z.array(lendingSchema).max(5)
});

export type DashboardSummary = z.infer<typeof dashboardSummarySchema>;

// Asset with category details (for joined queries)
export const assetWithCategorySchema = assetSchema.extend({
  category: categorySchema
});

export type AssetWithCategory = z.infer<typeof assetWithCategorySchema>;

// Lending with asset and category details (for joined queries)
export const lendingWithDetailsSchema = lendingSchema.extend({
  asset: assetWithCategorySchema
});

export type LendingWithDetails = z.infer<typeof lendingWithDetailsSchema>;