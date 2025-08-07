import { db } from '../db';
import { categoriesTable, assetsTable } from '../db/schema';
import { type CreateCategoryInput, type UpdateCategoryInput, type Category } from '../schema';
import { eq } from 'drizzle-orm';

export async function createCategory(input: CreateCategoryInput): Promise<Category> {
  try {
    const result = await db.insert(categoriesTable)
      .values({
        name: input.name,
        description: input.description || null
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Category creation failed:', error);
    throw error;
  }
}

export async function getCategories(): Promise<Category[]> {
  try {
    const result = await db.select()
      .from(categoriesTable)
      .execute();

    return result;
  } catch (error) {
    console.error('Failed to fetch categories:', error);
    throw error;
  }
}

export async function getCategoryById(id: number): Promise<Category | null> {
  try {
    const result = await db.select()
      .from(categoriesTable)
      .where(eq(categoriesTable.id, id))
      .execute();

    return result[0] || null;
  } catch (error) {
    console.error('Failed to fetch category by ID:', error);
    throw error;
  }
}

export async function updateCategory(input: UpdateCategoryInput): Promise<Category> {
  try {
    // Check if category exists
    const existing = await getCategoryById(input.id);
    if (!existing) {
      throw new Error(`Category with id ${input.id} not found`);
    }

    // Build update object with only provided fields
    const updateData: Partial<typeof categoriesTable.$inferInsert> = {};
    
    if (input.name !== undefined) {
      updateData.name = input.name;
    }
    
    if (input.description !== undefined) {
      updateData.description = input.description;
    }

    // Only update if there are fields to update
    if (Object.keys(updateData).length === 0) {
      return existing;
    }

    const result = await db.update(categoriesTable)
      .set(updateData)
      .where(eq(categoriesTable.id, input.id))
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Category update failed:', error);
    throw error;
  }
}

export async function deleteCategory(id: number): Promise<{ success: boolean }> {
  try {
    // Check if category exists
    const existing = await getCategoryById(id);
    if (!existing) {
      throw new Error(`Category with id ${id} not found`);
    }

    // Check if category has associated assets
    const assetsWithCategory = await db.select()
      .from(assetsTable)
      .where(eq(assetsTable.category_id, id))
      .execute();

    if (assetsWithCategory.length > 0) {
      throw new Error(`Cannot delete category with ${assetsWithCategory.length} associated assets`);
    }

    await db.delete(categoriesTable)
      .where(eq(categoriesTable.id, id))
      .execute();

    return { success: true };
  } catch (error) {
    console.error('Category deletion failed:', error);
    throw error;
  }
}