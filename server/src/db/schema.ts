import { serial, text, pgTable, timestamp, numeric, integer, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const userRoleEnum = pgEnum('user_role', ['admin', 'manager', 'staff']);
export const assetStatusEnum = pgEnum('asset_status', ['available', 'lent', 'maintenance', 'damaged', 'retired']);
export const lendingStatusEnum = pgEnum('lending_status', ['active', 'returned', 'overdue']);

// Users table
export const usersTable = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  email: text('email').notNull().unique(),
  password_hash: text('password_hash').notNull(),
  role: userRoleEnum('role').notNull().default('staff'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Categories table
export const categoriesTable = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'), // Nullable by default
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Assets table
export const assetsTable = pgTable('assets', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'), // Nullable by default
  category_id: integer('category_id').notNull().references(() => categoriesTable.id),
  serial_number: text('serial_number'), // Nullable by default
  purchase_date: timestamp('purchase_date'), // Nullable by default
  purchase_price: numeric('purchase_price', { precision: 10, scale: 2 }), // Nullable by default
  current_value: numeric('current_value', { precision: 10, scale: 2 }), // Nullable by default
  status: assetStatusEnum('status').notNull().default('available'),
  location: text('location'), // Nullable by default
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Lendings table
export const lendingsTable = pgTable('lendings', {
  id: serial('id').primaryKey(),
  asset_id: integer('asset_id').notNull().references(() => assetsTable.id),
  borrower_name: text('borrower_name').notNull(),
  borrower_email: text('borrower_email'), // Nullable by default
  borrower_phone: text('borrower_phone'), // Nullable by default
  department: text('department'), // Nullable by default
  lent_date: timestamp('lent_date').defaultNow().notNull(),
  expected_return_date: timestamp('expected_return_date').notNull(),
  actual_return_date: timestamp('actual_return_date'), // Nullable by default
  status: lendingStatusEnum('status').notNull().default('active'),
  notes: text('notes'), // Nullable by default
  lent_by_user_id: integer('lent_by_user_id').notNull().references(() => usersTable.id),
  returned_by_user_id: integer('returned_by_user_id').references(() => usersTable.id), // Nullable by default
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(usersTable, ({ many }) => ({
  lentItems: many(lendingsTable, { relationName: 'lent_by' }),
  returnedItems: many(lendingsTable, { relationName: 'returned_by' }),
}));

export const categoriesRelations = relations(categoriesTable, ({ many }) => ({
  assets: many(assetsTable),
}));

export const assetsRelations = relations(assetsTable, ({ one, many }) => ({
  category: one(categoriesTable, {
    fields: [assetsTable.category_id],
    references: [categoriesTable.id],
  }),
  lendings: many(lendingsTable),
}));

export const lendingsRelations = relations(lendingsTable, ({ one }) => ({
  asset: one(assetsTable, {
    fields: [lendingsTable.asset_id],
    references: [assetsTable.id],
  }),
  lentByUser: one(usersTable, {
    fields: [lendingsTable.lent_by_user_id],
    references: [usersTable.id],
    relationName: 'lent_by',
  }),
  returnedByUser: one(usersTable, {
    fields: [lendingsTable.returned_by_user_id],
    references: [usersTable.id],
    relationName: 'returned_by',
  }),
}));

// TypeScript types for the table schemas
export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;

export type Category = typeof categoriesTable.$inferSelect;
export type NewCategory = typeof categoriesTable.$inferInsert;

export type Asset = typeof assetsTable.$inferSelect;
export type NewAsset = typeof assetsTable.$inferInsert;

export type Lending = typeof lendingsTable.$inferSelect;
export type NewLending = typeof lendingsTable.$inferInsert;

// Export all tables and relations for proper query building
export const tables = {
  users: usersTable,
  categories: categoriesTable,
  assets: assetsTable,
  lendings: lendingsTable,
};