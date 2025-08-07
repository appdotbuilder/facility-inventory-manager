import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, categoriesTable, assetsTable, lendingsTable } from '../db/schema';
import { getDashboardSummary } from '../handlers/dashboard';

describe('getDashboardSummary', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty dashboard summary when no data exists', async () => {
    const result = await getDashboardSummary();

    expect(result.total_assets).toBe(0);
    expect(result.available_assets).toBe(0);
    expect(result.lent_assets).toBe(0);
    expect(result.overdue_lendings).toBe(0);
    expect(result.assets_in_maintenance).toBe(0);
    expect(result.total_categories).toBe(0);
    expect(result.recent_lendings).toHaveLength(0);
    expect(result.recent_returns).toHaveLength(0);
  });

  it('should return correct asset counts by status', async () => {
    // Create test user
    const [user] = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com',
        password_hash: 'hashedpw',
        role: 'staff'
      })
      .returning()
      .execute();

    // Create test category
    const [category] = await db.insert(categoriesTable)
      .values({
        name: 'Electronics',
        description: 'Electronic devices'
      })
      .returning()
      .execute();

    // Create assets with different statuses
    await db.insert(assetsTable)
      .values([
        {
          name: 'Laptop 1',
          category_id: category.id,
          status: 'available'
        },
        {
          name: 'Laptop 2',
          category_id: category.id,
          status: 'available'
        },
        {
          name: 'Laptop 3',
          category_id: category.id,
          status: 'lent'
        },
        {
          name: 'Laptop 4',
          category_id: category.id,
          status: 'maintenance'
        }
      ])
      .execute();

    const result = await getDashboardSummary();

    expect(result.total_assets).toBe(4);
    expect(result.available_assets).toBe(2);
    expect(result.lent_assets).toBe(1);
    expect(result.assets_in_maintenance).toBe(1);
    expect(result.total_categories).toBe(1);
  });

  it('should count overdue lendings correctly', async () => {
    // Create prerequisite data
    const [user] = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com',
        password_hash: 'hashedpw',
        role: 'staff'
      })
      .returning()
      .execute();

    const [category] = await db.insert(categoriesTable)
      .values({
        name: 'Electronics',
        description: 'Electronic devices'
      })
      .returning()
      .execute();

    const [asset1, asset2, asset3] = await db.insert(assetsTable)
      .values([
        {
          name: 'Laptop 1',
          category_id: category.id,
          status: 'lent'
        },
        {
          name: 'Laptop 2',
          category_id: category.id,
          status: 'lent'
        },
        {
          name: 'Laptop 3',
          category_id: category.id,
          status: 'lent'
        }
      ])
      .returning()
      .execute();

    // Create lendings - some overdue, some not
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    await db.insert(lendingsTable)
      .values([
        {
          asset_id: asset1.id,
          borrower_name: 'John Doe',
          expected_return_date: yesterday, // Overdue
          status: 'active',
          lent_by_user_id: user.id
        },
        {
          asset_id: asset2.id,
          borrower_name: 'Jane Smith',
          expected_return_date: yesterday, // Overdue
          status: 'active',
          lent_by_user_id: user.id
        },
        {
          asset_id: asset3.id,
          borrower_name: 'Bob Johnson',
          expected_return_date: tomorrow, // Not overdue
          status: 'active',
          lent_by_user_id: user.id
        }
      ])
      .execute();

    const result = await getDashboardSummary();

    expect(result.overdue_lendings).toBe(2);
    expect(result.recent_lendings).toHaveLength(3);
  });

  it('should return recent lendings and returns correctly', async () => {
    // Create prerequisite data
    const [user] = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com',
        password_hash: 'hashedpw',
        role: 'staff'
      })
      .returning()
      .execute();

    const [category] = await db.insert(categoriesTable)
      .values({
        name: 'Electronics',
        description: 'Electronic devices'
      })
      .returning()
      .execute();

    const assets = await db.insert(assetsTable)
      .values([
        { name: 'Laptop 1', category_id: category.id, status: 'lent' },
        { name: 'Laptop 2', category_id: category.id, status: 'available' },
        { name: 'Laptop 3', category_id: category.id, status: 'lent' }
      ])
      .returning()
      .execute();

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const returnDate = new Date();
    returnDate.setHours(returnDate.getHours() - 1);

    // Create active lendings and returned lendings
    await db.insert(lendingsTable)
      .values([
        {
          asset_id: assets[0].id,
          borrower_name: 'Active Borrower 1',
          borrower_email: 'active1@example.com',
          expected_return_date: tomorrow,
          status: 'active',
          lent_by_user_id: user.id
        },
        {
          asset_id: assets[2].id,
          borrower_name: 'Active Borrower 2',
          borrower_email: 'active2@example.com',
          expected_return_date: tomorrow,
          status: 'active',
          lent_by_user_id: user.id
        },
        {
          asset_id: assets[1].id,
          borrower_name: 'Returned Borrower',
          borrower_email: 'returned@example.com',
          expected_return_date: tomorrow,
          actual_return_date: returnDate,
          status: 'returned',
          lent_by_user_id: user.id,
          returned_by_user_id: user.id
        }
      ])
      .execute();

    const result = await getDashboardSummary();

    // Verify recent lendings
    expect(result.recent_lendings).toHaveLength(2);
    expect(result.recent_lendings[0].status).toBe('active');
    expect(result.recent_lendings[0].borrower_name).toMatch(/Active Borrower/);

    // Verify recent returns
    expect(result.recent_returns).toHaveLength(1);
    expect(result.recent_returns[0].status).toBe('returned');
    expect(result.recent_returns[0].borrower_name).toBe('Returned Borrower');
    expect(result.recent_returns[0].actual_return_date).toBeInstanceOf(Date);
  });

  it('should limit recent activities to 5 items each', async () => {
    // Create prerequisite data
    const [user] = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com',
        password_hash: 'hashedpw',
        role: 'staff'
      })
      .returning()
      .execute();

    const [category] = await db.insert(categoriesTable)
      .values({
        name: 'Electronics',
        description: 'Electronic devices'
      })
      .returning()
      .execute();

    // Create 7 assets for testing
    const assets = await db.insert(assetsTable)
      .values(Array.from({ length: 7 }, (_, i) => ({
        name: `Asset ${i + 1}`,
        category_id: category.id,
        status: i < 6 ? 'lent' as const : 'available' as const
      })))
      .returning()
      .execute();

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const returnDate = new Date();
    returnDate.setHours(returnDate.getHours() - 1);

    // Create 6 active lendings
    const activeLendings = assets.slice(0, 6).map((asset, i) => ({
      asset_id: asset.id,
      borrower_name: `Active Borrower ${i + 1}`,
      expected_return_date: tomorrow,
      status: 'active' as const,
      lent_by_user_id: user.id
    }));

    // Create 6 returned lendings  
    const returnedLendings = assets.slice(0, 6).map((asset, i) => ({
      asset_id: asset.id,
      borrower_name: `Returned Borrower ${i + 1}`,
      expected_return_date: tomorrow,
      actual_return_date: returnDate,
      status: 'returned' as const,
      lent_by_user_id: user.id,
      returned_by_user_id: user.id
    }));

    await db.insert(lendingsTable)
      .values([...activeLendings, ...returnedLendings])
      .execute();

    const result = await getDashboardSummary();

    // Should limit to 5 items each
    expect(result.recent_lendings).toHaveLength(5);
    expect(result.recent_returns).toHaveLength(5);

    // Verify they're all the correct status
    result.recent_lendings.forEach(lending => {
      expect(lending.status).toBe('active');
    });

    result.recent_returns.forEach(lending => {
      expect(lending.status).toBe('returned');
      expect(lending.actual_return_date).toBeInstanceOf(Date);
    });
  });

  it('should handle multiple categories correctly', async () => {
    // Create multiple categories
    await db.insert(categoriesTable)
      .values([
        { name: 'Electronics', description: 'Electronic devices' },
        { name: 'Furniture', description: 'Office furniture' },
        { name: 'Tools', description: 'Maintenance tools' }
      ])
      .execute();

    const result = await getDashboardSummary();

    expect(result.total_categories).toBe(3);
  });
});