import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, categoriesTable, assetsTable, lendingsTable } from '../db/schema';
import { 
  createLending,
  getLendings,
  getActiveLendings,
  getOverdueLendings,
  getLendingById,
  getLendingsByAsset,
  returnAsset,
  updateLending
} from '../handlers/lendings';
import { type CreateLendingInput, type ReturnAssetInput } from '../schema';
import { eq } from 'drizzle-orm';

// Test data
const testUser = {
  username: 'testuser',
  email: 'test@example.com',
  password_hash: 'hashedpassword',
  role: 'staff' as const
};

const testCategory = {
  name: 'Test Category',
  description: 'A category for testing'
};

const testAsset = {
  name: 'Test Asset',
  description: 'An asset for testing',
  status: 'available' as const,
  location: 'Office A'
};

const testLendingInput: CreateLendingInput = {
  asset_id: 1, // Will be updated with actual asset ID
  borrower_name: 'John Doe',
  borrower_email: 'john@example.com',
  borrower_phone: '+1234567890',
  department: 'IT',
  expected_return_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
  notes: 'Test lending',
  lent_by_user_id: 1 // Will be updated with actual user ID
};

describe('Lending Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper function to create prerequisite data
  async function createPrerequisites() {
    // Create user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    // Create category
    const categoryResult = await db.insert(categoriesTable)
      .values(testCategory)
      .returning()
      .execute();

    // Create asset
    const assetResult = await db.insert(assetsTable)
      .values({
        ...testAsset,
        category_id: categoryResult[0].id
      })
      .returning()
      .execute();

    return {
      user: userResult[0],
      category: categoryResult[0],
      asset: assetResult[0]
    };
  }

  describe('createLending', () => {
    it('should create a lending record and update asset status', async () => {
      const { user, asset } = await createPrerequisites();
      
      const input = {
        ...testLendingInput,
        asset_id: asset.id,
        lent_by_user_id: user.id
      };

      const result = await createLending(input);

      // Verify lending record
      expect(result.asset_id).toEqual(asset.id);
      expect(result.borrower_name).toEqual('John Doe');
      expect(result.borrower_email).toEqual('john@example.com');
      expect(result.borrower_phone).toEqual('+1234567890');
      expect(result.department).toEqual('IT');
      expect(result.status).toEqual('active');
      expect(result.lent_by_user_id).toEqual(user.id);
      expect(result.notes).toEqual('Test lending');
      expect(result.id).toBeDefined();
      expect(result.lent_date).toBeInstanceOf(Date);
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.expected_return_date).toBeInstanceOf(Date);

      // Verify asset status was updated
      const updatedAsset = await db.select()
        .from(assetsTable)
        .where(eq(assetsTable.id, asset.id))
        .execute();

      expect(updatedAsset[0].status).toEqual('lent');
    });

    it('should throw error when asset does not exist', async () => {
      const { user } = await createPrerequisites();
      
      const input = {
        ...testLendingInput,
        asset_id: 999, // Non-existent asset
        lent_by_user_id: user.id
      };

      await expect(createLending(input)).rejects.toThrow(/asset not found/i);
    });

    it('should throw error when asset is not available', async () => {
      const { user, category } = await createPrerequisites();

      // Create an asset that's already lent
      const lentAsset = await db.insert(assetsTable)
        .values({
          ...testAsset,
          category_id: category.id,
          status: 'lent'
        })
        .returning()
        .execute();

      const input = {
        ...testLendingInput,
        asset_id: lentAsset[0].id,
        lent_by_user_id: user.id
      };

      await expect(createLending(input)).rejects.toThrow(/not available for lending/i);
    });

    it('should throw error when user does not exist', async () => {
      const { asset } = await createPrerequisites();
      
      const input = {
        ...testLendingInput,
        asset_id: asset.id,
        lent_by_user_id: 999 // Non-existent user
      };

      await expect(createLending(input)).rejects.toThrow(/user not found/i);
    });

    it('should handle optional fields correctly', async () => {
      const { user, asset } = await createPrerequisites();
      
      const input = {
        asset_id: asset.id,
        borrower_name: 'Jane Doe',
        expected_return_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        lent_by_user_id: user.id
        // Omitting optional fields
      };

      const result = await createLending(input);

      expect(result.borrower_email).toBeNull();
      expect(result.borrower_phone).toBeNull();
      expect(result.department).toBeNull();
      expect(result.notes).toBeNull();
    });
  });

  describe('getLendings', () => {
    it('should return all lending records with asset and category details', async () => {
      const { user, asset } = await createPrerequisites();
      
      // Create a lending record
      const input = {
        ...testLendingInput,
        asset_id: asset.id,
        lent_by_user_id: user.id
      };
      await createLending(input);

      const results = await getLendings();

      expect(results).toHaveLength(1);
      const lending = results[0];
      expect(lending.borrower_name).toEqual('John Doe');
      expect(lending.asset).toBeDefined();
      expect(lending.asset.name).toEqual('Test Asset');
      expect(lending.asset.category).toBeDefined();
      expect(lending.asset.category.name).toEqual('Test Category');
    });

    it('should return empty array when no lendings exist', async () => {
      const results = await getLendings();
      expect(results).toHaveLength(0);
    });
  });

  describe('getActiveLendings', () => {
    it('should return only active lending records', async () => {
      const { user, asset, category } = await createPrerequisites();
      
      // Create another asset for second lending
      const asset2 = await db.insert(assetsTable)
        .values({
          name: 'Test Asset 2',
          description: 'Second test asset',
          category_id: category.id,
          status: 'available'
        })
        .returning()
        .execute();

      // Create active lending
      const activeInput = {
        ...testLendingInput,
        asset_id: asset.id,
        lent_by_user_id: user.id
      };
      await createLending(activeInput);

      // Create another lending and then return it
      const returnInput = {
        ...testLendingInput,
        asset_id: asset2[0].id,
        lent_by_user_id: user.id
      };
      const lending2 = await createLending(returnInput);

      // Return the second asset
      await returnAsset({
        lending_id: lending2.id,
        returned_by_user_id: user.id
      });

      const results = await getActiveLendings();

      expect(results).toHaveLength(1);
      expect(results[0].status).toEqual('active');
      expect(results[0].asset_id).toEqual(asset.id);
    });
  });

  describe('getOverdueLendings', () => {
    it('should return only overdue lending records', async () => {
      const { user, asset, category } = await createPrerequisites();

      // Create another asset for second lending
      const asset2 = await db.insert(assetsTable)
        .values({
          name: 'Test Asset 2',
          description: 'Second test asset',
          category_id: category.id,
          status: 'available'
        })
        .returning()
        .execute();

      // Create overdue lending (expected return date in the past)
      const overdueInput = {
        ...testLendingInput,
        asset_id: asset.id,
        lent_by_user_id: user.id,
        expected_return_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 1 week ago
      };
      await createLending(overdueInput);

      // Create current lending (expected return date in the future)
      const currentInput = {
        ...testLendingInput,
        asset_id: asset2[0].id,
        lent_by_user_id: user.id,
        expected_return_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 1 week from now
      };
      await createLending(currentInput);

      const results = await getOverdueLendings();

      expect(results).toHaveLength(1);
      expect(results[0].asset_id).toEqual(asset.id);
      expect(results[0].status).toEqual('active');
    });
  });

  describe('getLendingById', () => {
    it('should return lending record with details by id', async () => {
      const { user, asset } = await createPrerequisites();
      
      const input = {
        ...testLendingInput,
        asset_id: asset.id,
        lent_by_user_id: user.id
      };
      const lending = await createLending(input);

      const result = await getLendingById(lending.id);

      expect(result).not.toBeNull();
      expect(result!.id).toEqual(lending.id);
      expect(result!.borrower_name).toEqual('John Doe');
      expect(result!.asset).toBeDefined();
      expect(result!.asset.name).toEqual('Test Asset');
      expect(result!.asset.category).toBeDefined();
      expect(result!.asset.category.name).toEqual('Test Category');
    });

    it('should return null when lending does not exist', async () => {
      const result = await getLendingById(999);
      expect(result).toBeNull();
    });
  });

  describe('getLendingsByAsset', () => {
    it('should return all lending records for a specific asset', async () => {
      const { user, asset, category } = await createPrerequisites();

      // Create another asset
      const asset2 = await db.insert(assetsTable)
        .values({
          name: 'Test Asset 2',
          description: 'Second test asset',
          category_id: category.id,
          status: 'available'
        })
        .returning()
        .execute();

      // Create lending for first asset
      const input1 = {
        ...testLendingInput,
        asset_id: asset.id,
        lent_by_user_id: user.id
      };
      await createLending(input1);

      // Create lending for second asset
      const input2 = {
        ...testLendingInput,
        asset_id: asset2[0].id,
        lent_by_user_id: user.id
      };
      await createLending(input2);

      const results = await getLendingsByAsset(asset.id);

      expect(results).toHaveLength(1);
      expect(results[0].asset_id).toEqual(asset.id);
    });
  });

  describe('returnAsset', () => {
    it('should process asset return and update records', async () => {
      const { user, asset } = await createPrerequisites();
      
      // Create lending first
      const input = {
        ...testLendingInput,
        asset_id: asset.id,
        lent_by_user_id: user.id
      };
      const lending = await createLending(input);

      const returnInput: ReturnAssetInput = {
        lending_id: lending.id,
        returned_by_user_id: user.id,
        return_notes: 'Asset returned in good condition'
      };

      const result = await returnAsset(returnInput);

      // Verify lending record was updated
      expect(result.status).toEqual('returned');
      expect(result.returned_by_user_id).toEqual(user.id);
      expect(result.actual_return_date).toBeInstanceOf(Date);
      expect(result.notes).toEqual('Asset returned in good condition');

      // Verify asset status was updated to available
      const updatedAsset = await db.select()
        .from(assetsTable)
        .where(eq(assetsTable.id, asset.id))
        .execute();

      expect(updatedAsset[0].status).toEqual('available');
    });

    it('should update asset status based on condition', async () => {
      const { user, asset } = await createPrerequisites();
      
      // Create lending first
      const input = {
        ...testLendingInput,
        asset_id: asset.id,
        lent_by_user_id: user.id
      };
      const lending = await createLending(input);

      const returnInput: ReturnAssetInput = {
        lending_id: lending.id,
        returned_by_user_id: user.id,
        asset_condition: 'damaged'
      };

      await returnAsset(returnInput);

      // Verify asset status was updated to damaged
      const updatedAsset = await db.select()
        .from(assetsTable)
        .where(eq(assetsTable.id, asset.id))
        .execute();

      expect(updatedAsset[0].status).toEqual('damaged');
    });

    it('should throw error when lending does not exist', async () => {
      const { user } = await createPrerequisites();

      const returnInput: ReturnAssetInput = {
        lending_id: 999, // Non-existent lending
        returned_by_user_id: user.id
      };

      await expect(returnAsset(returnInput)).rejects.toThrow(/lending record not found/i);
    });

    it('should throw error when lending is not active', async () => {
      const { user, asset } = await createPrerequisites();
      
      // Create and return a lending
      const input = {
        ...testLendingInput,
        asset_id: asset.id,
        lent_by_user_id: user.id
      };
      const lending = await createLending(input);

      // Return it once
      await returnAsset({
        lending_id: lending.id,
        returned_by_user_id: user.id
      });

      // Try to return it again
      await expect(returnAsset({
        lending_id: lending.id,
        returned_by_user_id: user.id
      })).rejects.toThrow(/not active/i);
    });

    it('should throw error when user does not exist', async () => {
      const { user, asset } = await createPrerequisites();
      
      // Create lending first
      const input = {
        ...testLendingInput,
        asset_id: asset.id,
        lent_by_user_id: user.id
      };
      const lending = await createLending(input);

      const returnInput: ReturnAssetInput = {
        lending_id: lending.id,
        returned_by_user_id: 999 // Non-existent user
      };

      await expect(returnAsset(returnInput)).rejects.toThrow(/user not found/i);
    });
  });

  describe('updateLending', () => {
    it('should update lending record details', async () => {
      const { user, asset } = await createPrerequisites();
      
      // Create lending first
      const input = {
        ...testLendingInput,
        asset_id: asset.id,
        lent_by_user_id: user.id
      };
      const lending = await createLending(input);

      const updates = {
        borrower_name: 'Jane Smith',
        borrower_email: 'jane@example.com',
        department: 'HR',
        notes: 'Updated notes'
      };

      const result = await updateLending(lending.id, updates);

      expect(result.borrower_name).toEqual('Jane Smith');
      expect(result.borrower_email).toEqual('jane@example.com');
      expect(result.department).toEqual('HR');
      expect(result.notes).toEqual('Updated notes');
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should throw error when lending does not exist', async () => {
      const updates = {
        borrower_name: 'Jane Smith'
      };

      await expect(updateLending(999, updates)).rejects.toThrow(/lending record not found/i);
    });

    it('should handle partial updates', async () => {
      const { user, asset } = await createPrerequisites();
      
      // Create lending first
      const input = {
        ...testLendingInput,
        asset_id: asset.id,
        lent_by_user_id: user.id
      };
      const lending = await createLending(input);

      const updates = {
        borrower_name: 'Updated Name'
        // Only updating name, other fields should remain unchanged
      };

      const result = await updateLending(lending.id, updates);

      expect(result.borrower_name).toEqual('Updated Name');
      expect(result.borrower_email).toEqual('john@example.com'); // Should remain unchanged
      expect(result.department).toEqual('IT'); // Should remain unchanged
    });
  });
});