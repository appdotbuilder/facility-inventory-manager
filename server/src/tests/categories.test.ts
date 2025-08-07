import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { categoriesTable, assetsTable } from '../db/schema';
import { type CreateCategoryInput, type UpdateCategoryInput } from '../schema';
import { 
  createCategory, 
  getCategories, 
  getCategoryById, 
  updateCategory, 
  deleteCategory 
} from '../handlers/categories';
import { eq } from 'drizzle-orm';

const testCategoryInput: CreateCategoryInput = {
  name: 'Electronics',
  description: 'Electronic devices and equipment'
};

const testCategoryInputMinimal: CreateCategoryInput = {
  name: 'Basic Category'
};

describe('Categories Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('createCategory', () => {
    it('should create a category with all fields', async () => {
      const result = await createCategory(testCategoryInput);

      expect(result.name).toEqual('Electronics');
      expect(result.description).toEqual('Electronic devices and equipment');
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should create a category with minimal fields', async () => {
      const result = await createCategory(testCategoryInputMinimal);

      expect(result.name).toEqual('Basic Category');
      expect(result.description).toBeNull();
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should save category to database', async () => {
      const result = await createCategory(testCategoryInput);

      const categories = await db.select()
        .from(categoriesTable)
        .where(eq(categoriesTable.id, result.id))
        .execute();

      expect(categories).toHaveLength(1);
      expect(categories[0].name).toEqual('Electronics');
      expect(categories[0].description).toEqual('Electronic devices and equipment');
    });
  });

  describe('getCategories', () => {
    it('should return empty array when no categories exist', async () => {
      const result = await getCategories();
      expect(result).toEqual([]);
    });

    it('should return all categories', async () => {
      await createCategory(testCategoryInput);
      await createCategory(testCategoryInputMinimal);

      const result = await getCategories();
      
      expect(result).toHaveLength(2);
      expect(result.some(cat => cat.name === 'Electronics')).toBe(true);
      expect(result.some(cat => cat.name === 'Basic Category')).toBe(true);
    });

    it('should return categories with correct structure', async () => {
      await createCategory(testCategoryInput);
      
      const result = await getCategories();
      const category = result[0];
      
      expect(category.id).toBeDefined();
      expect(category.name).toBeDefined();
      expect(category.description).toBeDefined();
      expect(category.created_at).toBeInstanceOf(Date);
      expect(category.updated_at).toBeInstanceOf(Date);
    });
  });

  describe('getCategoryById', () => {
    it('should return null for non-existent category', async () => {
      const result = await getCategoryById(999);
      expect(result).toBeNull();
    });

    it('should return category by ID', async () => {
      const created = await createCategory(testCategoryInput);
      
      const result = await getCategoryById(created.id);
      
      expect(result).not.toBeNull();
      expect(result!.id).toEqual(created.id);
      expect(result!.name).toEqual('Electronics');
      expect(result!.description).toEqual('Electronic devices and equipment');
    });

    it('should return correct category when multiple exist', async () => {
      const category1 = await createCategory(testCategoryInput);
      const category2 = await createCategory(testCategoryInputMinimal);
      
      const result = await getCategoryById(category2.id);
      
      expect(result!.id).toEqual(category2.id);
      expect(result!.name).toEqual('Basic Category');
      expect(result!.description).toBeNull();
    });
  });

  describe('updateCategory', () => {
    it('should throw error for non-existent category', async () => {
      const updateInput: UpdateCategoryInput = {
        id: 999,
        name: 'Updated Name'
      };

      await expect(updateCategory(updateInput)).rejects.toThrow(/Category with id 999 not found/);
    });

    it('should update category name only', async () => {
      const created = await createCategory(testCategoryInput);
      
      const updateInput: UpdateCategoryInput = {
        id: created.id,
        name: 'Updated Electronics'
      };
      
      const result = await updateCategory(updateInput);
      
      expect(result.id).toEqual(created.id);
      expect(result.name).toEqual('Updated Electronics');
      expect(result.description).toEqual('Electronic devices and equipment'); // Unchanged
    });

    it('should update category description only', async () => {
      const created = await createCategory(testCategoryInput);
      
      const updateInput: UpdateCategoryInput = {
        id: created.id,
        description: 'Updated description'
      };
      
      const result = await updateCategory(updateInput);
      
      expect(result.id).toEqual(created.id);
      expect(result.name).toEqual('Electronics'); // Unchanged
      expect(result.description).toEqual('Updated description');
    });

    it('should update both name and description', async () => {
      const created = await createCategory(testCategoryInput);
      
      const updateInput: UpdateCategoryInput = {
        id: created.id,
        name: 'Updated Electronics',
        description: 'Updated description'
      };
      
      const result = await updateCategory(updateInput);
      
      expect(result.name).toEqual('Updated Electronics');
      expect(result.description).toEqual('Updated description');
    });

    it('should set description to null', async () => {
      const created = await createCategory(testCategoryInput);
      
      const updateInput: UpdateCategoryInput = {
        id: created.id,
        description: null
      };
      
      const result = await updateCategory(updateInput);
      
      expect(result.description).toBeNull();
    });

    it('should return unchanged category when no update fields provided', async () => {
      const created = await createCategory(testCategoryInput);
      
      const updateInput: UpdateCategoryInput = {
        id: created.id
      };
      
      const result = await updateCategory(updateInput);
      
      expect(result).toEqual(created);
    });

    it('should persist changes to database', async () => {
      const created = await createCategory(testCategoryInput);
      
      const updateInput: UpdateCategoryInput = {
        id: created.id,
        name: 'Updated Electronics'
      };
      
      await updateCategory(updateInput);
      
      const fromDb = await getCategoryById(created.id);
      expect(fromDb!.name).toEqual('Updated Electronics');
    });
  });

  describe('deleteCategory', () => {
    it('should throw error for non-existent category', async () => {
      await expect(deleteCategory(999)).rejects.toThrow(/Category with id 999 not found/);
    });

    it('should delete category successfully', async () => {
      const created = await createCategory(testCategoryInput);
      
      const result = await deleteCategory(created.id);
      
      expect(result.success).toBe(true);
      
      const fromDb = await getCategoryById(created.id);
      expect(fromDb).toBeNull();
    });

    it('should throw error when category has associated assets', async () => {
      // Create category
      const category = await createCategory(testCategoryInput);
      
      // Create asset with this category
      await db.insert(assetsTable)
        .values({
          name: 'Test Asset',
          category_id: category.id,
          status: 'available'
        })
        .execute();
      
      await expect(deleteCategory(category.id)).rejects.toThrow(/Cannot delete category with 1 associated assets/);
    });

    it('should remove category from database on successful deletion', async () => {
      const created = await createCategory(testCategoryInput);
      
      await deleteCategory(created.id);
      
      const categories = await db.select()
        .from(categoriesTable)
        .where(eq(categoriesTable.id, created.id))
        .execute();
      
      expect(categories).toHaveLength(0);
    });

    it('should handle multiple assets in error message', async () => {
      // Create category
      const category = await createCategory(testCategoryInput);
      
      // Create multiple assets with this category
      await db.insert(assetsTable)
        .values([
          { name: 'Asset 1', category_id: category.id, status: 'available' },
          { name: 'Asset 2', category_id: category.id, status: 'available' },
          { name: 'Asset 3', category_id: category.id, status: 'available' }
        ])
        .execute();
      
      await expect(deleteCategory(category.id)).rejects.toThrow(/Cannot delete category with 3 associated assets/);
    });
  });
});