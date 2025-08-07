import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, categoriesTable, assetsTable, lendingsTable } from '../db/schema';
import { type GenerateReportInput } from '../schema';
import {
  generateReport,
  generateInventoryReport,
  generateLendingReport,
  generateReturnsReport,
  generateOverdueReport,
  generateCategorySummaryReport,
} from '../handlers/reports';

// Test data setup helpers
const createTestUser = async (username = 'testuser', role: 'admin' | 'manager' | 'staff' = 'staff') => {
  const result = await db.insert(usersTable)
    .values({
      username,
      email: `${username}@test.com`,
      password_hash: 'hashed_password',
      role,
    })
    .returning()
    .execute();
  return result[0];
};

const createTestCategory = async (name = 'Electronics') => {
  const result = await db.insert(categoriesTable)
    .values({
      name,
      description: `${name} category`,
    })
    .returning()
    .execute();
  return result[0];
};

const createTestAsset = async (categoryId: number, name = 'Test Asset', status: 'available' | 'lent' | 'maintenance' | 'damaged' | 'retired' = 'available') => {
  const result = await db.insert(assetsTable)
    .values({
      name,
      description: 'Test asset description',
      category_id: categoryId,
      serial_number: `SN${Math.random()}`,
      purchase_price: '100.00',
      current_value: '80.00',
      status,
      location: 'Test Location',
    })
    .returning()
    .execute();
  
  return {
    ...result[0],
    purchase_price: result[0].purchase_price ? parseFloat(result[0].purchase_price) : null,
    current_value: result[0].current_value ? parseFloat(result[0].current_value) : null,
  };
};

const createTestLending = async (assetId: number, userId: number, options: {
  borrowerName?: string;
  status?: 'active' | 'returned' | 'overdue';
  expectedReturnDate?: Date;
  actualReturnDate?: Date;
  lentDate?: Date;
} = {}) => {
  const lentDate = options.lentDate || new Date();
  const expectedReturnDate = options.expectedReturnDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
  
  const result = await db.insert(lendingsTable)
    .values({
      asset_id: assetId,
      borrower_name: options.borrowerName || 'John Doe',
      borrower_email: 'john@test.com',
      department: 'IT',
      lent_date: lentDate,
      expected_return_date: expectedReturnDate,
      actual_return_date: options.actualReturnDate || null,
      status: options.status || 'active',
      lent_by_user_id: userId,
    })
    .returning()
    .execute();
  return result[0];
};

describe('generateInventoryReport', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should generate inventory report with category summaries', async () => {
    // Create test data
    const category1 = await createTestCategory('Electronics');
    const category2 = await createTestCategory('Furniture');
    
    // Create assets with different statuses
    await createTestAsset(category1.id, 'Laptop', 'available');
    await createTestAsset(category1.id, 'Monitor', 'lent');
    await createTestAsset(category1.id, 'Keyboard', 'maintenance');
    await createTestAsset(category2.id, 'Desk', 'available');
    await createTestAsset(category2.id, 'Chair', 'damaged');

    const input: GenerateReportInput = {
      report_type: 'inventory',
    };

    const result = await generateInventoryReport(input);

    expect(result.report_type).toBe('inventory');
    expect(result.generated_at).toBeInstanceOf(Date);
    expect(result.data).toHaveLength(2);

    // Check Electronics category
    const electronicsData = result.data.find((item: any) => item.category_name === 'Electronics') as any;
    expect(electronicsData).toBeDefined();
    expect(electronicsData['total_assets']).toBe(3);
    expect(electronicsData['available']).toBe(1);
    expect(electronicsData['lent']).toBe(1);
    expect(electronicsData['maintenance']).toBe(1);
    expect(electronicsData['total_purchase_value']).toBe(300); // 3 * 100
    expect(electronicsData['total_current_value']).toBe(240); // 3 * 80

    // Check Furniture category
    const furnitureData = result.data.find((item: any) => item.category_name === 'Furniture') as any;
    expect(furnitureData).toBeDefined();
    expect(furnitureData['total_assets']).toBe(2);
    expect(furnitureData['available']).toBe(1);
    expect(furnitureData['damaged']).toBe(1);
  });

  it('should filter by category_id', async () => {
    const category1 = await createTestCategory('Electronics');
    const category2 = await createTestCategory('Furniture');
    
    await createTestAsset(category1.id, 'Laptop');
    await createTestAsset(category2.id, 'Desk');

    const input: GenerateReportInput = {
      report_type: 'inventory',
      category_id: category1.id,
    };

    const result = await generateInventoryReport(input);

    expect(result.data).toHaveLength(1);
    expect((result.data[0] as any).category_name).toBe('Electronics');
  });

  it('should filter by status', async () => {
    const category = await createTestCategory();
    
    await createTestAsset(category.id, 'Available Asset', 'available');
    await createTestAsset(category.id, 'Lent Asset', 'lent');

    const input: GenerateReportInput = {
      report_type: 'inventory',
      status: 'available',
    };

    const result = await generateInventoryReport(input);

    expect(result.data).toHaveLength(1);
    const data = result.data[0] as any;
    expect(data.total_assets).toBe(1);
    expect(data.available).toBe(1);
    expect(data.lent).toBe(0);
  });
});

describe('generateLendingReport', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should generate lending report with borrower details', async () => {
    const user = await createTestUser();
    const category = await createTestCategory();
    const asset = await createTestAsset(category.id, 'Test Laptop');

    await createTestLending(asset.id, user.id, {
      borrowerName: 'Jane Smith',
    });

    const input: GenerateReportInput = {
      report_type: 'lending',
    };

    const result = await generateLendingReport(input);

    expect(result.report_type).toBe('lending');
    expect(result.data).toHaveLength(1);

    const lending = result.data[0] as any;
    expect(lending.asset_name).toBe('Test Laptop');
    expect(lending.category_name).toBe('Electronics');
    expect(lending.borrower_name).toBe('Jane Smith');
    expect(lending.lent_by).toBe('testuser');
    expect(lending.status).toBe('active');
    expect(lending.lent_date).toBeDefined();
    expect(lending.expected_return_date).toBeDefined();
  });

  it('should filter by date range', async () => {
    const user = await createTestUser();
    const category = await createTestCategory();
    const asset1 = await createTestAsset(category.id, 'Asset 1');
    const asset2 = await createTestAsset(category.id, 'Asset 2');

    const oldDate = new Date('2023-01-01');
    const recentDate = new Date();

    await createTestLending(asset1.id, user.id, { lentDate: oldDate });
    await createTestLending(asset2.id, user.id, { lentDate: recentDate });

    const input: GenerateReportInput = {
      report_type: 'lending',
      start_date: new Date('2023-12-01'),
    };

    const result = await generateLendingReport(input);

    expect(result.data).toHaveLength(1);
    expect((result.data[0] as any).asset_name).toBe('Asset 2');
  });
});

describe('generateReturnsReport', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should generate returns report for returned items only', async () => {
    const user = await createTestUser();
    const category = await createTestCategory();
    const asset1 = await createTestAsset(category.id, 'Returned Asset');
    const asset2 = await createTestAsset(category.id, 'Active Asset');

    const returnDate = new Date();

    // Create one returned and one active lending
    await createTestLending(asset1.id, user.id, {
      status: 'returned',
      actualReturnDate: returnDate,
    });
    await createTestLending(asset2.id, user.id, {
      status: 'active',
    });

    const input: GenerateReportInput = {
      report_type: 'returns',
    };

    const result = await generateReturnsReport(input);

    expect(result.report_type).toBe('returns');
    expect(result.data).toHaveLength(1);

    const returnedItem = result.data[0] as any;
    expect(returnedItem.asset_name).toBe('Returned Asset');
    expect(returnedItem.actual_return_date).toBeDefined();
    expect(returnedItem.lent_by).toBe('testuser');
  });

  it('should filter returns by date range', async () => {
    const user = await createTestUser();
    const category = await createTestCategory();
    const asset1 = await createTestAsset(category.id, 'Old Return');
    const asset2 = await createTestAsset(category.id, 'Recent Return');

    const oldReturn = new Date('2023-01-01');
    const recentReturn = new Date();

    await createTestLending(asset1.id, user.id, {
      actualReturnDate: oldReturn,
    });
    await createTestLending(asset2.id, user.id, {
      actualReturnDate: recentReturn,
    });

    const input: GenerateReportInput = {
      report_type: 'returns',
      start_date: new Date('2023-12-01'),
    };

    const result = await generateReturnsReport(input);

    expect(result.data).toHaveLength(1);
    expect((result.data[0] as any).asset_name).toBe('Recent Return');
  });
});

describe('generateOverdueReport', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should generate overdue report for past-due active lendings', async () => {
    const user = await createTestUser();
    const category = await createTestCategory();
    const asset1 = await createTestAsset(category.id, 'Overdue Asset');
    const asset2 = await createTestAsset(category.id, 'Current Asset');

    const pastDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000); // 5 days ago
    const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000); // 5 days from now

    // Create overdue lending
    await createTestLending(asset1.id, user.id, {
      borrowerName: 'Overdue Borrower',
      status: 'active',
      expectedReturnDate: pastDate,
    });

    // Create current lending (not overdue)
    await createTestLending(asset2.id, user.id, {
      status: 'active',
      expectedReturnDate: futureDate,
    });

    const result = await generateOverdueReport();

    expect(result.report_type).toBe('overdue');
    expect(result.data).toHaveLength(1);

    const overdueItem = result.data[0] as any;
    expect(overdueItem.asset_name).toBe('Overdue Asset');
    expect(overdueItem.borrower_name).toBe('Overdue Borrower');
    expect(overdueItem.days_overdue).toBeGreaterThan(0);
    expect(overdueItem.lent_by).toBe('testuser');
  });

  it('should not include returned items in overdue report', async () => {
    const user = await createTestUser();
    const category = await createTestCategory();
    const asset = await createTestAsset(category.id);

    const pastDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);

    await createTestLending(asset.id, user.id, {
      status: 'returned',
      expectedReturnDate: pastDate,
      actualReturnDate: new Date(),
    });

    const result = await generateOverdueReport();

    expect(result.data).toHaveLength(0);
  });
});

describe('generateCategorySummaryReport', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should generate category summary with utilization rates', async () => {
    const user = await createTestUser();
    const category = await createTestCategory('Electronics');
    
    // Create 4 assets
    const asset1 = await createTestAsset(category.id, 'Laptop 1', 'available');
    const asset2 = await createTestAsset(category.id, 'Laptop 2', 'lent');
    const asset3 = await createTestAsset(category.id, 'Monitor', 'available');
    const asset4 = await createTestAsset(category.id, 'Popular Asset', 'lent');

    // Create lendings (2 active out of 4 assets = 50% utilization)
    await createTestLending(asset2.id, user.id, { status: 'active' });
    await createTestLending(asset4.id, user.id, { status: 'active' });
    
    // Create multiple lendings for popular asset
    await createTestLending(asset4.id, user.id, { status: 'returned', actualReturnDate: new Date() });
    await createTestLending(asset4.id, user.id, { status: 'returned', actualReturnDate: new Date() });

    const result = await generateCategorySummaryReport();

    expect(result.report_type).toBe('category_summary');
    expect(result.data).toHaveLength(1);

    const summary = result.data[0] as any;
    expect(summary.category_name).toBe('Electronics');
    expect(summary.total_assets).toBe(4);
    expect(summary.total_value).toBe(320); // 4 * 80
    expect(Number(summary.active_lendings)).toBe(2);
    expect(summary.utilization_rate).toBe(0.5); // 2/4 = 50%
    expect(summary.most_lent_asset).toBe('Popular Asset');
    expect(summary.most_lent_count).toBe(3); // 1 active + 2 returned
  });

  it('should handle categories with no assets', async () => {
    await createTestCategory('Empty Category');

    const result = await generateCategorySummaryReport();

    expect(result.data).toHaveLength(1);
    
    const summary = result.data[0] as any;
    expect(summary.category_name).toBe('Empty Category');
    expect(summary.total_assets).toBe(0);
    expect(summary.total_value).toBe(0);
    expect(summary.utilization_rate).toBe(0);
  });
});

describe('generateReport', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should route to correct report generator based on type', async () => {
    const user = await createTestUser();
    const category = await createTestCategory();
    const asset = await createTestAsset(category.id);

    // Test inventory report
    const inventoryInput: GenerateReportInput = { report_type: 'inventory' };
    const inventoryResult = await generateReport(inventoryInput);
    expect(inventoryResult.report_type).toBe('inventory');

    // Test lending report
    const lendingInput: GenerateReportInput = { report_type: 'lending' };
    const lendingResult = await generateReport(lendingInput);
    expect(lendingResult.report_type).toBe('lending');

    // Test category summary report
    const summaryInput: GenerateReportInput = { report_type: 'category_summary' };
    const summaryResult = await generateReport(summaryInput);
    expect(summaryResult.report_type).toBe('category_summary');
  });

  it('should throw error for unsupported report type', async () => {
    const input = { report_type: 'invalid' } as any;
    
    await expect(generateReport(input)).rejects.toThrow(/Unsupported report type/i);
  });
});