import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { assetsTable, categoriesTable, usersTable, lendingsTable } from '../db/schema';
import { type CreateAssetInput, type UpdateAssetInput } from '../schema';
import { 
  createAsset, 
  getAssets, 
  getAssetById, 
  getAssetsByCategory, 
  getAssetsByStatus, 
  updateAsset, 
  deleteAsset 
} from '../handlers/assets';
import { eq } from 'drizzle-orm';

// Test data
const testCategory = {
  name: 'Test Category',
  description: 'Category for testing'
};

const testAssetInput: CreateAssetInput = {
  name: 'Test Asset',
  description: 'Asset for testing',
  category_id: 1, // Will be set after creating category
  serial_number: 'TEST-001',
  purchase_date: new Date('2023-01-15'),
  purchase_price: 1500.50,
  current_value: 1200.75,
  status: 'available',
  location: 'Storage Room A'
};

describe('Assets handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let categoryId: number;
  let userId: number;

  beforeEach(async () => {
    // Create a test category
    const categoryResult = await db.insert(categoriesTable)
      .values(testCategory)
      .returning()
      .execute();
    categoryId = categoryResult[0].id;

    // Create a test user for lending operations
    const userResult = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com',
        password_hash: 'hashedpassword',
        role: 'staff'
      })
      .returning()
      .execute();
    userId = userResult[0].id;

    // Update test input with actual category ID
    testAssetInput.category_id = categoryId;
  });

  describe('createAsset', () => {
    it('should create an asset with all fields', async () => {
      const result = await createAsset(testAssetInput);

      expect(result.name).toEqual('Test Asset');
      expect(result.description).toEqual('Asset for testing');
      expect(result.category_id).toEqual(categoryId);
      expect(result.serial_number).toEqual('TEST-001');
      expect(result.purchase_date).toEqual(new Date('2023-01-15'));
      expect(result.purchase_price).toEqual(1500.50);
      expect(typeof result.purchase_price).toBe('number');
      expect(result.current_value).toEqual(1200.75);
      expect(typeof result.current_value).toBe('number');
      expect(result.status).toEqual('available');
      expect(result.location).toEqual('Storage Room A');
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should create asset with minimal required fields', async () => {
      const minimalInput: CreateAssetInput = {
        name: 'Minimal Asset',
        category_id: categoryId,
        status: 'available'
      };

      const result = await createAsset(minimalInput);

      expect(result.name).toEqual('Minimal Asset');
      expect(result.category_id).toEqual(categoryId);
      expect(result.status).toEqual('available');
      expect(result.description).toBeNull();
      expect(result.serial_number).toBeNull();
      expect(result.purchase_date).toBeNull();
      expect(result.purchase_price).toBeNull();
      expect(result.current_value).toBeNull();
      expect(result.location).toBeNull();
    });

    it('should save asset to database', async () => {
      const result = await createAsset(testAssetInput);

      const assets = await db.select()
        .from(assetsTable)
        .where(eq(assetsTable.id, result.id))
        .execute();

      expect(assets).toHaveLength(1);
      expect(assets[0].name).toEqual('Test Asset');
      expect(parseFloat(assets[0].purchase_price!)).toEqual(1500.50);
    });

    it('should throw error for non-existent category', async () => {
      const invalidInput = {
        ...testAssetInput,
        category_id: 999
      };

      await expect(createAsset(invalidInput)).rejects.toThrow(/Category with id 999 does not exist/i);
    });
  });

  describe('getAssets', () => {
    it('should return empty array when no assets exist', async () => {
      const result = await getAssets();
      expect(result).toEqual([]);
    });

    it('should return all assets with category details', async () => {
      // Create two assets
      await createAsset(testAssetInput);
      await createAsset({
        ...testAssetInput,
        name: 'Second Asset',
        serial_number: 'TEST-002'
      });

      const result = await getAssets();

      expect(result).toHaveLength(2);
      expect(result[0].name).toEqual('Test Asset');
      expect(result[0].category.name).toEqual('Test Category');
      expect(result[0].purchase_price).toEqual(1500.50);
      expect(typeof result[0].purchase_price).toBe('number');
      expect(result[1].name).toEqual('Second Asset');
      expect(result[1].category.name).toEqual('Test Category');
    });
  });

  describe('getAssetById', () => {
    it('should return asset with category details', async () => {
      const created = await createAsset(testAssetInput);
      const result = await getAssetById(created.id);

      expect(result).not.toBeNull();
      expect(result!.name).toEqual('Test Asset');
      expect(result!.category.name).toEqual('Test Category');
      expect(result!.purchase_price).toEqual(1500.50);
      expect(typeof result!.purchase_price).toBe('number');
    });

    it('should return null for non-existent asset', async () => {
      const result = await getAssetById(999);
      expect(result).toBeNull();
    });
  });

  describe('getAssetsByCategory', () => {
    it('should return assets for specific category', async () => {
      // Create another category
      const category2Result = await db.insert(categoriesTable)
        .values({ name: 'Category 2', description: null })
        .returning()
        .execute();
      const category2Id = category2Result[0].id;

      // Create assets in both categories
      await createAsset(testAssetInput);
      await createAsset({
        ...testAssetInput,
        name: 'Asset in Category 2',
        category_id: category2Id
      });

      const category1Assets = await getAssetsByCategory(categoryId);
      const category2Assets = await getAssetsByCategory(category2Id);

      expect(category1Assets).toHaveLength(1);
      expect(category1Assets[0].name).toEqual('Test Asset');
      expect(category1Assets[0].category.name).toEqual('Test Category');

      expect(category2Assets).toHaveLength(1);
      expect(category2Assets[0].name).toEqual('Asset in Category 2');
      expect(category2Assets[0].category.name).toEqual('Category 2');
    });

    it('should return empty array for category with no assets', async () => {
      const result = await getAssetsByCategory(categoryId);
      expect(result).toEqual([]);
    });
  });

  describe('getAssetsByStatus', () => {
    it('should return assets with specific status', async () => {
      await createAsset(testAssetInput);
      await createAsset({
        ...testAssetInput,
        name: 'Maintenance Asset',
        status: 'maintenance'
      });

      const availableAssets = await getAssetsByStatus('available');
      const maintenanceAssets = await getAssetsByStatus('maintenance');

      expect(availableAssets).toHaveLength(1);
      expect(availableAssets[0].status).toEqual('available');
      expect(availableAssets[0].name).toEqual('Test Asset');

      expect(maintenanceAssets).toHaveLength(1);
      expect(maintenanceAssets[0].status).toEqual('maintenance');
      expect(maintenanceAssets[0].name).toEqual('Maintenance Asset');
    });

    it('should return empty array for status with no assets', async () => {
      const result = await getAssetsByStatus('retired');
      expect(result).toEqual([]);
    });
  });

  describe('updateAsset', () => {
    let assetId: number;

    beforeEach(async () => {
      const created = await createAsset(testAssetInput);
      assetId = created.id;
    });

    it('should update all asset fields', async () => {
      const updateInput: UpdateAssetInput = {
        id: assetId,
        name: 'Updated Asset',
        description: 'Updated description',
        purchase_price: 2000.00,
        current_value: 1800.50,
        status: 'maintenance',
        location: 'Workshop'
      };

      const result = await updateAsset(updateInput);

      expect(result.id).toEqual(assetId);
      expect(result.name).toEqual('Updated Asset');
      expect(result.description).toEqual('Updated description');
      expect(result.purchase_price).toEqual(2000.00);
      expect(typeof result.purchase_price).toBe('number');
      expect(result.current_value).toEqual(1800.50);
      expect(typeof result.current_value).toBe('number');
      expect(result.status).toEqual('maintenance');
      expect(result.location).toEqual('Workshop');
      expect(result.updated_at.getTime()).toBeGreaterThan(result.created_at.getTime());
    });

    it('should update partial asset fields', async () => {
      const updateInput: UpdateAssetInput = {
        id: assetId,
        name: 'Partially Updated',
        status: 'lent'
      };

      const result = await updateAsset(updateInput);

      expect(result.name).toEqual('Partially Updated');
      expect(result.status).toEqual('lent');
      // Other fields should remain unchanged
      expect(result.description).toEqual('Asset for testing');
      expect(result.purchase_price).toEqual(1500.50);
    });

    it('should update asset in database', async () => {
      const updateInput: UpdateAssetInput = {
        id: assetId,
        name: 'Database Updated Asset'
      };

      await updateAsset(updateInput);

      const assets = await db.select()
        .from(assetsTable)
        .where(eq(assetsTable.id, assetId))
        .execute();

      expect(assets[0].name).toEqual('Database Updated Asset');
    });

    it('should throw error for non-existent asset', async () => {
      const updateInput: UpdateAssetInput = {
        id: 999,
        name: 'Non-existent'
      };

      await expect(updateAsset(updateInput)).rejects.toThrow(/Asset with id 999 not found/i);
    });

    it('should throw error for non-existent category when updating category_id', async () => {
      const updateInput: UpdateAssetInput = {
        id: assetId,
        category_id: 999
      };

      await expect(updateAsset(updateInput)).rejects.toThrow(/Category with id 999 does not exist/i);
    });
  });

  describe('deleteAsset', () => {
    let assetId: number;

    beforeEach(async () => {
      const created = await createAsset(testAssetInput);
      assetId = created.id;
    });

    it('should delete asset successfully', async () => {
      const result = await deleteAsset(assetId);

      expect(result.success).toBe(true);

      // Verify asset is deleted from database
      const assets = await db.select()
        .from(assetsTable)
        .where(eq(assetsTable.id, assetId))
        .execute();

      expect(assets).toHaveLength(0);
    });

    it('should throw error for non-existent asset', async () => {
      await expect(deleteAsset(999)).rejects.toThrow(/Asset with id 999 not found/i);
    });

    it('should throw error when asset is currently lent', async () => {
      // Create an active lending for the asset
      await db.insert(lendingsTable)
        .values({
          asset_id: assetId,
          borrower_name: 'Test Borrower',
          borrower_email: 'borrower@test.com',
          expected_return_date: new Date('2024-02-15'),
          status: 'active',
          lent_by_user_id: userId
        })
        .execute();

      await expect(deleteAsset(assetId)).rejects.toThrow(/Cannot delete asset.*lending/i);
    });

    it('should throw error when asset has any lending history', async () => {
      // Create a returned lending for the asset
      await db.insert(lendingsTable)
        .values({
          asset_id: assetId,
          borrower_name: 'Test Borrower',
          borrower_email: 'borrower@test.com',
          expected_return_date: new Date('2024-01-15'),
          actual_return_date: new Date('2024-01-14'),
          status: 'returned',
          lent_by_user_id: userId,
          returned_by_user_id: userId
        })
        .execute();

      await expect(deleteAsset(assetId)).rejects.toThrow(/Cannot delete asset.*lending/i);
    });
  });
});