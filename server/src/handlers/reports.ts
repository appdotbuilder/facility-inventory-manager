import { db } from '../db';
import { assetsTable, categoriesTable, lendingsTable, usersTable } from '../db/schema';
import { type GenerateReportInput, type ReportData } from '../schema';
import { eq, and, gte, lte, count, sum, sql, isNull, SQL, lt } from 'drizzle-orm';

export async function generateInventoryReport(input: GenerateReportInput): Promise<ReportData> {
  try {
    // Build conditions for asset filtering
    const conditions: SQL<unknown>[] = [];
    
    if (input.category_id !== undefined) {
      conditions.push(eq(assetsTable.category_id, input.category_id));
    }
    
    if (input.status) {
      conditions.push(eq(assetsTable.status, input.status as any));
    }

    // Base query with category join
    const baseQuery = db.select({
      category_id: categoriesTable.id,
      category_name: categoriesTable.name,
      asset_id: assetsTable.id,
      asset_name: assetsTable.name,
      status: assetsTable.status,
      purchase_price: assetsTable.purchase_price,
      current_value: assetsTable.current_value,
    })
    .from(assetsTable)
    .innerJoin(categoriesTable, eq(assetsTable.category_id, categoriesTable.id));

    // Apply filters if any
    const query = conditions.length > 0 
      ? baseQuery.where(and(...conditions))
      : baseQuery;

    const results = await query.execute();

    // Process data to create summary by category
    const categoryMap = new Map<number, {
      category_id: number;
      category_name: string;
      total_assets: number;
      available: number;
      lent: number;
      maintenance: number;
      damaged: number;
      retired: number;
      total_purchase_value: number;
      total_current_value: number;
    }>();

    results.forEach(result => {
      const key = result.category_id;
      if (!categoryMap.has(key)) {
        categoryMap.set(key, {
          category_id: result.category_id,
          category_name: result.category_name,
          total_assets: 0,
          available: 0,
          lent: 0,
          maintenance: 0,
          damaged: 0,
          retired: 0,
          total_purchase_value: 0,
          total_current_value: 0,
        });
      }

      const category = categoryMap.get(key)!;
      category.total_assets++;
      
      // Count by status
      switch (result.status) {
        case 'available':
          category.available++;
          break;
        case 'lent':
          category.lent++;
          break;
        case 'maintenance':
          category.maintenance++;
          break;
        case 'damaged':
          category.damaged++;
          break;
        case 'retired':
          category.retired++;
          break;
      }

      // Sum values (handle null values and convert numeric strings to numbers)
      if (result.purchase_price) {
        category.total_purchase_value += parseFloat(result.purchase_price);
      }
      if (result.current_value) {
        category.total_current_value += parseFloat(result.current_value);
      }
    });

    const reportData = Array.from(categoryMap.values());

    return {
      report_type: 'inventory',
      generated_at: new Date(),
      parameters: {
        category_id: input.category_id,
        status: input.status,
      },
      data: reportData,
    };
  } catch (error) {
    console.error('Inventory report generation failed:', error);
    throw error;
  }
}

export async function generateLendingReport(input: GenerateReportInput): Promise<ReportData> {
  try {
    // Build date range conditions
    const conditions: SQL<unknown>[] = [];
    
    if (input.start_date) {
      conditions.push(gte(lendingsTable.lent_date, input.start_date));
    }
    
    if (input.end_date) {
      conditions.push(lte(lendingsTable.lent_date, input.end_date));
    }

    // Query lending data with asset and user details
    const baseQuery = db.select({
      lending_id: lendingsTable.id,
      asset_name: assetsTable.name,
      category_name: categoriesTable.name,
      borrower_name: lendingsTable.borrower_name,
      borrower_email: lendingsTable.borrower_email,
      borrower_phone: lendingsTable.borrower_phone,
      department: lendingsTable.department,
      lent_date: lendingsTable.lent_date,
      expected_return_date: lendingsTable.expected_return_date,
      actual_return_date: lendingsTable.actual_return_date,
      status: lendingsTable.status,
      notes: lendingsTable.notes,
      lent_by_username: usersTable.username,
    })
    .from(lendingsTable)
    .innerJoin(assetsTable, eq(lendingsTable.asset_id, assetsTable.id))
    .innerJoin(categoriesTable, eq(assetsTable.category_id, categoriesTable.id))
    .innerJoin(usersTable, eq(lendingsTable.lent_by_user_id, usersTable.id));

    // Apply date filters if provided
    const query = conditions.length > 0 
      ? baseQuery.where(and(...conditions))
      : baseQuery;

    const results = await query.execute();

    const reportData = results.map(result => ({
      lending_id: result.lending_id,
      asset_name: result.asset_name,
      category_name: result.category_name,
      borrower_name: result.borrower_name,
      borrower_email: result.borrower_email,
      borrower_phone: result.borrower_phone,
      department: result.department,
      lent_date: result.lent_date.toISOString().split('T')[0],
      expected_return_date: result.expected_return_date.toISOString().split('T')[0],
      actual_return_date: result.actual_return_date?.toISOString().split('T')[0] || null,
      status: result.status,
      notes: result.notes,
      lent_by: result.lent_by_username,
    }));

    return {
      report_type: 'lending',
      generated_at: new Date(),
      parameters: {
        start_date: input.start_date,
        end_date: input.end_date,
      },
      data: reportData,
    };
  } catch (error) {
    console.error('Lending report generation failed:', error);
    throw error;
  }
}

export async function generateReturnsReport(input: GenerateReportInput): Promise<ReportData> {
  try {
    // Build date range conditions for return date
    const conditions: SQL<unknown>[] = [];
    
    // Only include returned items (not null actual_return_date)
    conditions.push(sql`${lendingsTable.actual_return_date} IS NOT NULL`);
    
    if (input.start_date) {
      conditions.push(gte(lendingsTable.actual_return_date, input.start_date));
    }
    
    if (input.end_date) {
      conditions.push(lte(lendingsTable.actual_return_date, input.end_date));
    }

    // Query returned lending data with asset and user details
    const baseQuery = db.select({
      lending_id: lendingsTable.id,
      asset_name: assetsTable.name,
      category_name: categoriesTable.name,
      borrower_name: lendingsTable.borrower_name,
      department: lendingsTable.department,
      lent_date: lendingsTable.lent_date,
      expected_return_date: lendingsTable.expected_return_date,
      actual_return_date: lendingsTable.actual_return_date,
      lent_by_username: sql<string>`lent_by_user.username`.as('lent_by_username'),
      returned_by_username: sql<string>`returned_by_user.username`.as('returned_by_username'),
      notes: lendingsTable.notes,
    })
    .from(lendingsTable)
    .innerJoin(assetsTable, eq(lendingsTable.asset_id, assetsTable.id))
    .innerJoin(categoriesTable, eq(assetsTable.category_id, categoriesTable.id))
    .innerJoin(sql`${usersTable} AS lent_by_user`, sql`${lendingsTable.lent_by_user_id} = lent_by_user.id`)
    .leftJoin(sql`${usersTable} AS returned_by_user`, sql`${lendingsTable.returned_by_user_id} = returned_by_user.id`);

    // Apply filters
    const query = conditions.length > 0 
      ? baseQuery.where(and(...conditions))
      : baseQuery;

    const results = await query.execute();

    const reportData = results.map(result => ({
      lending_id: result.lending_id,
      asset_name: result.asset_name,
      category_name: result.category_name,
      borrower_name: result.borrower_name,
      department: result.department,
      lent_date: result.lent_date.toISOString().split('T')[0],
      expected_return_date: result.expected_return_date.toISOString().split('T')[0],
      actual_return_date: result.actual_return_date?.toISOString().split('T')[0] || null,
      lent_by: result.lent_by_username,
      returned_by: result.returned_by_username || 'Unknown',
      notes: result.notes,
    }));

    return {
      report_type: 'returns',
      generated_at: new Date(),
      parameters: {
        start_date: input.start_date,
        end_date: input.end_date,
      },
      data: reportData,
    };
  } catch (error) {
    console.error('Returns report generation failed:', error);
    throw error;
  }
}

export async function generateOverdueReport(): Promise<ReportData> {
  try {
    const today = new Date();

    // Query overdue lendings (active status and past expected return date)
    const results = await db.select({
      lending_id: lendingsTable.id,
      asset_name: assetsTable.name,
      category_name: categoriesTable.name,
      borrower_name: lendingsTable.borrower_name,
      borrower_email: lendingsTable.borrower_email,
      borrower_phone: lendingsTable.borrower_phone,
      department: lendingsTable.department,
      lent_date: lendingsTable.lent_date,
      expected_return_date: lendingsTable.expected_return_date,
      lent_by_username: usersTable.username,
      notes: lendingsTable.notes,
    })
    .from(lendingsTable)
    .innerJoin(assetsTable, eq(lendingsTable.asset_id, assetsTable.id))
    .innerJoin(categoriesTable, eq(assetsTable.category_id, categoriesTable.id))
    .innerJoin(usersTable, eq(lendingsTable.lent_by_user_id, usersTable.id))
    .where(
      and(
        eq(lendingsTable.status, 'active'),
        lt(lendingsTable.expected_return_date, today)
      )
    )
    .execute();

    const reportData = results.map(result => {
      const daysDiff = Math.floor(
        (today.getTime() - result.expected_return_date.getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        lending_id: result.lending_id,
        asset_name: result.asset_name,
        category_name: result.category_name,
        borrower_name: result.borrower_name,
        borrower_email: result.borrower_email,
        borrower_phone: result.borrower_phone,
        department: result.department,
        lent_date: result.lent_date.toISOString().split('T')[0],
        expected_return_date: result.expected_return_date.toISOString().split('T')[0],
        days_overdue: daysDiff,
        lent_by: result.lent_by_username,
        notes: result.notes,
      };
    });

    return {
      report_type: 'overdue',
      generated_at: new Date(),
      parameters: {},
      data: reportData,
    };
  } catch (error) {
    console.error('Overdue report generation failed:', error);
    throw error;
  }
}

export async function generateCategorySummaryReport(): Promise<ReportData> {
  try {
    // Get category summary with asset counts and values
    const categoryStats = await db.select({
      category_id: categoriesTable.id,
      category_name: categoriesTable.name,
      total_assets: count(assetsTable.id),
      total_current_value: sum(assetsTable.current_value),
    })
    .from(categoriesTable)
    .leftJoin(assetsTable, eq(categoriesTable.id, assetsTable.category_id))
    .groupBy(categoriesTable.id, categoriesTable.name)
    .execute();

    // Get lending statistics per category
    const lendingStats = await db.select({
      category_id: categoriesTable.id,
      total_lendings: count(lendingsTable.id),
      active_lendings: sql<string>`COUNT(CASE WHEN ${lendingsTable.status} = 'active' THEN 1 END)`.as('active_lendings'),
    })
    .from(categoriesTable)
    .leftJoin(assetsTable, eq(categoriesTable.id, assetsTable.category_id))
    .leftJoin(lendingsTable, eq(assetsTable.id, lendingsTable.asset_id))
    .groupBy(categoriesTable.id)
    .execute();

    // Get most and least lent assets per category
    const assetPopularity = await db.select({
      category_id: assetsTable.category_id,
      asset_id: assetsTable.id,
      asset_name: assetsTable.name,
      lending_count: count(lendingsTable.id),
    })
    .from(assetsTable)
    .leftJoin(lendingsTable, eq(assetsTable.id, lendingsTable.asset_id))
    .groupBy(assetsTable.category_id, assetsTable.id, assetsTable.name)
    .execute();

    // Process data to create comprehensive summary
    const reportData = categoryStats.map(category => {
      const lending = lendingStats.find(l => l.category_id === category.category_id);
      const categoryAssets = assetPopularity.filter(a => a.category_id === category.category_id);
      
      // Find most and least lent assets
      const sortedAssets = categoryAssets.sort((a, b) => b.lending_count - a.lending_count);
      const mostLent = sortedAssets[0];
      const leastLent = sortedAssets[sortedAssets.length - 1];

      // Calculate utilization rate
      const totalAssets = category.total_assets;
      const activeLendings = lending?.active_lendings ? parseInt(lending.active_lendings) : 0;
      const utilizationRate = totalAssets > 0 ? activeLendings / totalAssets : 0;

      return {
        category_id: category.category_id,
        category_name: category.category_name,
        total_assets: totalAssets,
        total_value: category.total_current_value ? parseFloat(category.total_current_value) : 0,
        total_lendings: lending?.total_lendings || 0,
        active_lendings: activeLendings,
        utilization_rate: Math.round(utilizationRate * 100) / 100,
        most_lent_asset: mostLent?.asset_name || 'N/A',
        most_lent_count: mostLent?.lending_count || 0,
        least_lent_asset: leastLent?.asset_name || 'N/A',
        least_lent_count: leastLent?.lending_count || 0,
      };
    });

    return {
      report_type: 'category_summary',
      generated_at: new Date(),
      parameters: {},
      data: reportData,
    };
  } catch (error) {
    console.error('Category summary report generation failed:', error);
    throw error;
  }
}

export async function generateReport(input: GenerateReportInput): Promise<ReportData> {
  try {
    switch (input.report_type) {
      case 'inventory':
        return generateInventoryReport(input);
      case 'lending':
        return generateLendingReport(input);
      case 'returns':
        return generateReturnsReport(input);
      case 'overdue':
        return generateOverdueReport();
      case 'category_summary':
        return generateCategorySummaryReport();
      default:
        throw new Error(`Unsupported report type: ${input.report_type}`);
    }
  } catch (error) {
    console.error('Report generation failed:', error);
    throw error;
  }
}