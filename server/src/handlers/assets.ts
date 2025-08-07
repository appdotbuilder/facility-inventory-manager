import { db } from '../db';
import { assetsTable, categoriesTable, lendingsTable } from '../db/schema';
import { type CreateAssetInput, type UpdateAssetInput, type Asset, type AssetWithCategory } from '../schema';
import { eq, and } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

export async function createAsset(input: CreateAssetInput): Promise<Asset> {
  try {
    // Verify the category exists
    const categoryExists = await db.select()
      .from(categoriesTable)
      .where(eq(categoriesTable.id, input.category_id))
      .execute();

    if (categoryExists.length === 0) {
      throw new Error(`Category with id ${input.category_id} does not exist`);
    }

    // Insert the asset
    const result = await db.insert(assetsTable)
      .values({
        name: input.name,
        description: input.description || null,
        category_id: input.category_id,
        serial_number: input.serial_number || null,
        purchase_date: input.purchase_date || null,
        purchase_price: input.purchase_price ? input.purchase_price.toString() : null,
        current_value: input.current_value ? input.current_value.toString() : null,
        status: input.status,
        location: input.location || null
      })
      .returning()
      .execute();

    const asset = result[0];
    return {
      ...asset,
      purchase_price: asset.purchase_price ? parseFloat(asset.purchase_price) : null,
      current_value: asset.current_value ? parseFloat(asset.current_value) : null
    };
  } catch (error) {
    console.error('Asset creation failed:', error);
    throw error;
  }
}

export async function getAssets(): Promise<AssetWithCategory[]> {
  try {
    const results = await db.select()
      .from(assetsTable)
      .innerJoin(categoriesTable, eq(assetsTable.category_id, categoriesTable.id))
      .execute();

    return results.map(result => ({
      ...result.assets,
      purchase_price: result.assets.purchase_price ? parseFloat(result.assets.purchase_price) : null,
      current_value: result.assets.current_value ? parseFloat(result.assets.current_value) : null,
      category: result.categories
    }));
  } catch (error) {
    console.error('Failed to fetch assets:', error);
    throw error;
  }
}

export async function getAssetById(id: number): Promise<AssetWithCategory | null> {
  try {
    const results = await db.select()
      .from(assetsTable)
      .innerJoin(categoriesTable, eq(assetsTable.category_id, categoriesTable.id))
      .where(eq(assetsTable.id, id))
      .execute();

    if (results.length === 0) {
      return null;
    }

    const result = results[0];
    return {
      ...result.assets,
      purchase_price: result.assets.purchase_price ? parseFloat(result.assets.purchase_price) : null,
      current_value: result.assets.current_value ? parseFloat(result.assets.current_value) : null,
      category: result.categories
    };
  } catch (error) {
    console.error('Failed to fetch asset by id:', error);
    throw error;
  }
}

export async function getAssetsByCategory(categoryId: number): Promise<AssetWithCategory[]> {
  try {
    const results = await db.select()
      .from(assetsTable)
      .innerJoin(categoriesTable, eq(assetsTable.category_id, categoriesTable.id))
      .where(eq(assetsTable.category_id, categoryId))
      .execute();

    return results.map(result => ({
      ...result.assets,
      purchase_price: result.assets.purchase_price ? parseFloat(result.assets.purchase_price) : null,
      current_value: result.assets.current_value ? parseFloat(result.assets.current_value) : null,
      category: result.categories
    }));
  } catch (error) {
    console.error('Failed to fetch assets by category:', error);
    throw error;
  }
}

export async function getAssetsByStatus(status: string): Promise<AssetWithCategory[]> {
  try {
    const results = await db.select()
      .from(assetsTable)
      .innerJoin(categoriesTable, eq(assetsTable.category_id, categoriesTable.id))
      .where(eq(assetsTable.status, status as any))
      .execute();

    return results.map(result => ({
      ...result.assets,
      purchase_price: result.assets.purchase_price ? parseFloat(result.assets.purchase_price) : null,
      current_value: result.assets.current_value ? parseFloat(result.assets.current_value) : null,
      category: result.categories
    }));
  } catch (error) {
    console.error('Failed to fetch assets by status:', error);
    throw error;
  }
}

export async function updateAsset(input: UpdateAssetInput): Promise<Asset> {
  try {
    // Check if asset exists
    const existingAsset = await db.select()
      .from(assetsTable)
      .where(eq(assetsTable.id, input.id))
      .execute();

    if (existingAsset.length === 0) {
      throw new Error(`Asset with id ${input.id} not found`);
    }

    // If category_id is being updated, verify it exists
    if (input.category_id !== undefined) {
      const categoryExists = await db.select()
        .from(categoriesTable)
        .where(eq(categoriesTable.id, input.category_id))
        .execute();

      if (categoryExists.length === 0) {
        throw new Error(`Category with id ${input.category_id} does not exist`);
      }
    }

    // Build update values object
    const updateValues: any = {};
    
    if (input.name !== undefined) updateValues.name = input.name;
    if (input.description !== undefined) updateValues.description = input.description;
    if (input.category_id !== undefined) updateValues.category_id = input.category_id;
    if (input.serial_number !== undefined) updateValues.serial_number = input.serial_number;
    if (input.purchase_date !== undefined) updateValues.purchase_date = input.purchase_date;
    if (input.purchase_price !== undefined) {
      updateValues.purchase_price = input.purchase_price ? input.purchase_price.toString() : null;
    }
    if (input.current_value !== undefined) {
      updateValues.current_value = input.current_value ? input.current_value.toString() : null;
    }
    if (input.status !== undefined) updateValues.status = input.status;
    if (input.location !== undefined) updateValues.location = input.location;

    // Always update the updated_at timestamp
    updateValues.updated_at = new Date();

    const result = await db.update(assetsTable)
      .set(updateValues)
      .where(eq(assetsTable.id, input.id))
      .returning()
      .execute();

    const asset = result[0];
    return {
      ...asset,
      purchase_price: asset.purchase_price ? parseFloat(asset.purchase_price) : null,
      current_value: asset.current_value ? parseFloat(asset.current_value) : null
    };
  } catch (error) {
    console.error('Asset update failed:', error);
    throw error;
  }
}

export async function deleteAsset(id: number): Promise<{ success: boolean }> {
  try {
    // Check if asset exists
    const existingAsset = await db.select()
      .from(assetsTable)
      .where(eq(assetsTable.id, id))
      .execute();

    if (existingAsset.length === 0) {
      throw new Error(`Asset with id ${id} not found`);
    }

    // Check if asset has any lending history
    const lendingHistory = await db.select()
      .from(lendingsTable)
      .where(eq(lendingsTable.asset_id, id))
      .execute();

    if (lendingHistory.length > 0) {
      throw new Error('Cannot delete asset that has lending history');
    }

    // Delete the asset
    await db.delete(assetsTable)
      .where(eq(assetsTable.id, id))
      .execute();

    return { success: true };
  } catch (error) {
    console.error('Asset deletion failed:', error);
    throw error;
  }
}