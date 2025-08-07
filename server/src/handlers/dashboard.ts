import { db } from '../db';
import { assetsTable, lendingsTable, categoriesTable } from '../db/schema';
import { type DashboardSummary } from '../schema';
import { eq, desc, count, and, lt } from 'drizzle-orm';

export async function getDashboardSummary(): Promise<DashboardSummary> {
  try {
    // Get asset counts by status
    const assetCounts = await db.select({
      total: count(),
      status: assetsTable.status
    })
    .from(assetsTable)
    .groupBy(assetsTable.status)
    .execute();

    // Get total categories count
    const [categoriesCount] = await db.select({
      count: count()
    })
    .from(categoriesTable)
    .execute();

    // Get overdue lendings count
    const now = new Date();
    const [overdueLendings] = await db.select({
      count: count()
    })
    .from(lendingsTable)
    .where(
      and(
        eq(lendingsTable.status, 'active'),
        lt(lendingsTable.expected_return_date, now)
      )
    )
    .execute();

    // Get recent lendings (last 5)
    const recentLendings = await db.select()
      .from(lendingsTable)
      .where(eq(lendingsTable.status, 'active'))
      .orderBy(desc(lendingsTable.created_at))
      .limit(5)
      .execute();

    // Get recent returns (last 5)
    const recentReturns = await db.select()
      .from(lendingsTable)
      .where(eq(lendingsTable.status, 'returned'))
      .orderBy(desc(lendingsTable.actual_return_date))
      .limit(5)
      .execute();

    // Calculate counts from asset status grouping
    let totalAssets = 0;
    let availableAssets = 0;
    let lentAssets = 0;
    let assetsInMaintenance = 0;

    assetCounts.forEach(({ total, status }) => {
      totalAssets += total;
      switch (status) {
        case 'available':
          availableAssets = total;
          break;
        case 'lent':
          lentAssets = total;
          break;
        case 'maintenance':
          assetsInMaintenance = total;
          break;
      }
    });

    return {
      total_assets: totalAssets,
      available_assets: availableAssets,
      lent_assets: lentAssets,
      overdue_lendings: overdueLendings.count,
      assets_in_maintenance: assetsInMaintenance,
      total_categories: categoriesCount.count,
      recent_lendings: recentLendings,
      recent_returns: recentReturns
    };
  } catch (error) {
    console.error('Dashboard summary generation failed:', error);
    throw error;
  }
}