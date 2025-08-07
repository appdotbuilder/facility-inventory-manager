import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schemas
import {
  loginInputSchema,
  createUserInputSchema,
  createCategoryInputSchema,
  updateCategoryInputSchema,
  createAssetInputSchema,
  updateAssetInputSchema,
  createLendingInputSchema,
  returnAssetInputSchema,
  generateReportInputSchema
} from './schema';

// Import handlers
import { login, createUser, getUsers } from './handlers/auth';
import {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory
} from './handlers/categories';
import {
  createAsset,
  getAssets,
  getAssetById,
  getAssetsByCategory,
  getAssetsByStatus,
  updateAsset,
  deleteAsset
} from './handlers/assets';
import {
  createLending,
  getLendings,
  getActiveLendings,
  getOverdueLendings,
  getLendingById,
  getLendingsByAsset,
  returnAsset,
  updateLending
} from './handlers/lendings';
import {
  generateReport,
  generateInventoryReport,
  generateLendingReport,
  generateReturnsReport,
  generateOverdueReport,
  generateCategorySummaryReport
} from './handlers/reports';
import { getDashboardSummary } from './handlers/dashboard';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Authentication routes
  login: publicProcedure
    .input(loginInputSchema)
    .mutation(({ input }) => login(input)),

  createUser: publicProcedure
    .input(createUserInputSchema)
    .mutation(({ input }) => createUser(input)),

  getUsers: publicProcedure
    .query(() => getUsers()),

  // Dashboard routes
  getDashboardSummary: publicProcedure
    .query(() => getDashboardSummary()),

  // Category routes
  createCategory: publicProcedure
    .input(createCategoryInputSchema)
    .mutation(({ input }) => createCategory(input)),

  getCategories: publicProcedure
    .query(() => getCategories()),

  getCategoryById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => getCategoryById(input.id)),

  updateCategory: publicProcedure
    .input(updateCategoryInputSchema)
    .mutation(({ input }) => updateCategory(input)),

  deleteCategory: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => deleteCategory(input.id)),

  // Asset routes
  createAsset: publicProcedure
    .input(createAssetInputSchema)
    .mutation(({ input }) => createAsset(input)),

  getAssets: publicProcedure
    .query(() => getAssets()),

  getAssetById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => getAssetById(input.id)),

  getAssetsByCategory: publicProcedure
    .input(z.object({ categoryId: z.number() }))
    .query(({ input }) => getAssetsByCategory(input.categoryId)),

  getAssetsByStatus: publicProcedure
    .input(z.object({ status: z.string() }))
    .query(({ input }) => getAssetsByStatus(input.status)),

  updateAsset: publicProcedure
    .input(updateAssetInputSchema)
    .mutation(({ input }) => updateAsset(input)),

  deleteAsset: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => deleteAsset(input.id)),

  // Lending routes
  createLending: publicProcedure
    .input(createLendingInputSchema)
    .mutation(({ input }) => createLending(input)),

  getLendings: publicProcedure
    .query(() => getLendings()),

  getActiveLendings: publicProcedure
    .query(() => getActiveLendings()),

  getOverdueLendings: publicProcedure
    .query(() => getOverdueLendings()),

  getLendingById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => getLendingById(input.id)),

  getLendingsByAsset: publicProcedure
    .input(z.object({ assetId: z.number() }))
    .query(({ input }) => getLendingsByAsset(input.assetId)),

  returnAsset: publicProcedure
    .input(returnAssetInputSchema)
    .mutation(({ input }) => returnAsset(input)),

  updateLending: publicProcedure
    .input(z.object({
      id: z.number(),
      updates: z.record(z.unknown())
    }))
    .mutation(({ input }) => updateLending(input.id, input.updates)),

  // Report routes
  generateReport: publicProcedure
    .input(generateReportInputSchema)
    .mutation(({ input }) => generateReport(input)),

  generateInventoryReport: publicProcedure
    .input(generateReportInputSchema)
    .mutation(({ input }) => generateInventoryReport(input)),

  generateLendingReport: publicProcedure
    .input(generateReportInputSchema)
    .mutation(({ input }) => generateLendingReport(input)),

  generateReturnsReport: publicProcedure
    .input(generateReportInputSchema)
    .mutation(({ input }) => generateReturnsReport(input)),

  generateOverdueReport: publicProcedure
    .mutation(() => generateOverdueReport()),

  generateCategorySummaryReport: publicProcedure
    .mutation(() => generateCategorySummaryReport()),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`TRPC server listening at port: ${port}`);
  console.log('Facilities & Infrastructure Inventory Management System API ready');
}

start();