import { db } from '../db';
import { lendingsTable, assetsTable, categoriesTable, usersTable } from '../db/schema';
import { type CreateLendingInput, type ReturnAssetInput, type Lending, type LendingWithDetails } from '../schema';
import { eq, and, lt, SQL } from 'drizzle-orm';

export async function createLending(input: CreateLendingInput): Promise<Lending> {
  try {
    // First, verify that the asset exists and is available
    const asset = await db.select()
      .from(assetsTable)
      .where(eq(assetsTable.id, input.asset_id))
      .execute();

    if (asset.length === 0) {
      throw new Error('Asset not found');
    }

    if (asset[0].status !== 'available') {
      throw new Error('Asset is not available for lending');
    }

    // Verify that the user exists
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.lent_by_user_id))
      .execute();

    if (user.length === 0) {
      throw new Error('User not found');
    }

    // Create the lending record
    const lendingResult = await db.insert(lendingsTable)
      .values({
        asset_id: input.asset_id,
        borrower_name: input.borrower_name,
        borrower_email: input.borrower_email || null,
        borrower_phone: input.borrower_phone || null,
        department: input.department || null,
        expected_return_date: input.expected_return_date,
        notes: input.notes || null,
        lent_by_user_id: input.lent_by_user_id,
        status: 'active'
      })
      .returning()
      .execute();

    // Update asset status to 'lent'
    await db.update(assetsTable)
      .set({ status: 'lent', updated_at: new Date() })
      .where(eq(assetsTable.id, input.asset_id))
      .execute();

    return lendingResult[0];
  } catch (error) {
    console.error('Lending creation failed:', error);
    throw error;
  }
}

export async function getLendings(): Promise<LendingWithDetails[]> {
  try {
    const results = await db.select()
      .from(lendingsTable)
      .innerJoin(assetsTable, eq(lendingsTable.asset_id, assetsTable.id))
      .innerJoin(categoriesTable, eq(assetsTable.category_id, categoriesTable.id))
      .execute();

    return results.map(result => ({
      ...result.lendings,
      asset: {
        ...result.assets,
        purchase_price: result.assets.purchase_price ? parseFloat(result.assets.purchase_price) : null,
        current_value: result.assets.current_value ? parseFloat(result.assets.current_value) : null,
        category: result.categories
      }
    }));
  } catch (error) {
    console.error('Get lendings failed:', error);
    throw error;
  }
}

export async function getActiveLendings(): Promise<LendingWithDetails[]> {
  try {
    const results = await db.select()
      .from(lendingsTable)
      .innerJoin(assetsTable, eq(lendingsTable.asset_id, assetsTable.id))
      .innerJoin(categoriesTable, eq(assetsTable.category_id, categoriesTable.id))
      .where(eq(lendingsTable.status, 'active'))
      .execute();

    return results.map(result => ({
      ...result.lendings,
      asset: {
        ...result.assets,
        purchase_price: result.assets.purchase_price ? parseFloat(result.assets.purchase_price) : null,
        current_value: result.assets.current_value ? parseFloat(result.assets.current_value) : null,
        category: result.categories
      }
    }));
  } catch (error) {
    console.error('Get active lendings failed:', error);
    throw error;
  }
}

export async function getOverdueLendings(): Promise<LendingWithDetails[]> {
  try {
    const today = new Date();
    const results = await db.select()
      .from(lendingsTable)
      .innerJoin(assetsTable, eq(lendingsTable.asset_id, assetsTable.id))
      .innerJoin(categoriesTable, eq(assetsTable.category_id, categoriesTable.id))
      .where(
        and(
          eq(lendingsTable.status, 'active'),
          lt(lendingsTable.expected_return_date, today)
        )
      )
      .execute();

    return results.map(result => ({
      ...result.lendings,
      asset: {
        ...result.assets,
        purchase_price: result.assets.purchase_price ? parseFloat(result.assets.purchase_price) : null,
        current_value: result.assets.current_value ? parseFloat(result.assets.current_value) : null,
        category: result.categories
      }
    }));
  } catch (error) {
    console.error('Get overdue lendings failed:', error);
    throw error;
  }
}

export async function getLendingById(id: number): Promise<LendingWithDetails | null> {
  try {
    const results = await db.select()
      .from(lendingsTable)
      .innerJoin(assetsTable, eq(lendingsTable.asset_id, assetsTable.id))
      .innerJoin(categoriesTable, eq(assetsTable.category_id, categoriesTable.id))
      .where(eq(lendingsTable.id, id))
      .execute();

    if (results.length === 0) {
      return null;
    }

    const result = results[0];
    return {
      ...result.lendings,
      asset: {
        ...result.assets,
        purchase_price: result.assets.purchase_price ? parseFloat(result.assets.purchase_price) : null,
        current_value: result.assets.current_value ? parseFloat(result.assets.current_value) : null,
        category: result.categories
      }
    };
  } catch (error) {
    console.error('Get lending by id failed:', error);
    throw error;
  }
}

export async function getLendingsByAsset(assetId: number): Promise<LendingWithDetails[]> {
  try {
    const results = await db.select()
      .from(lendingsTable)
      .innerJoin(assetsTable, eq(lendingsTable.asset_id, assetsTable.id))
      .innerJoin(categoriesTable, eq(assetsTable.category_id, categoriesTable.id))
      .where(eq(lendingsTable.asset_id, assetId))
      .execute();

    return results.map(result => ({
      ...result.lendings,
      asset: {
        ...result.assets,
        purchase_price: result.assets.purchase_price ? parseFloat(result.assets.purchase_price) : null,
        current_value: result.assets.current_value ? parseFloat(result.assets.current_value) : null,
        category: result.categories
      }
    }));
  } catch (error) {
    console.error('Get lendings by asset failed:', error);
    throw error;
  }
}

export async function returnAsset(input: ReturnAssetInput): Promise<Lending> {
  try {
    // First, verify that the lending record exists and is active
    const lending = await db.select()
      .from(lendingsTable)
      .where(eq(lendingsTable.id, input.lending_id))
      .execute();

    if (lending.length === 0) {
      throw new Error('Lending record not found');
    }

    if (lending[0].status !== 'active') {
      throw new Error('Lending record is not active');
    }

    // Verify that the user exists
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.returned_by_user_id))
      .execute();

    if (user.length === 0) {
      throw new Error('User not found');
    }

    const returnDate = new Date();

    // Update the lending record
    const updatedLending = await db.update(lendingsTable)
      .set({
        actual_return_date: returnDate,
        status: 'returned',
        returned_by_user_id: input.returned_by_user_id,
        notes: input.return_notes || lending[0].notes,
        updated_at: returnDate
      })
      .where(eq(lendingsTable.id, input.lending_id))
      .returning()
      .execute();

    // Update asset status based on condition
    let newAssetStatus: 'available' | 'maintenance' | 'damaged' = 'available';
    if (input.asset_condition === 'damaged') {
      newAssetStatus = 'damaged';
    } else if (input.asset_condition === 'needs_maintenance') {
      newAssetStatus = 'maintenance';
    }

    await db.update(assetsTable)
      .set({ 
        status: newAssetStatus,
        updated_at: returnDate
      })
      .where(eq(assetsTable.id, lending[0].asset_id))
      .execute();

    return updatedLending[0];
  } catch (error) {
    console.error('Asset return failed:', error);
    throw error;
  }
}

export async function updateLending(id: number, updates: Partial<Lending>): Promise<Lending> {
  try {
    // First, verify that the lending record exists
    const existingLending = await db.select()
      .from(lendingsTable)
      .where(eq(lendingsTable.id, id))
      .execute();

    if (existingLending.length === 0) {
      throw new Error('Lending record not found');
    }

    // Build update object, excluding fields that shouldn't be updated directly
    const updateData: any = {
      updated_at: new Date()
    };

    if (updates.borrower_name !== undefined) updateData.borrower_name = updates.borrower_name;
    if (updates.borrower_email !== undefined) updateData.borrower_email = updates.borrower_email;
    if (updates.borrower_phone !== undefined) updateData.borrower_phone = updates.borrower_phone;
    if (updates.department !== undefined) updateData.department = updates.department;
    if (updates.expected_return_date !== undefined) updateData.expected_return_date = updates.expected_return_date;
    if (updates.notes !== undefined) updateData.notes = updates.notes;

    // Update the lending record
    const updatedLending = await db.update(lendingsTable)
      .set(updateData)
      .where(eq(lendingsTable.id, id))
      .returning()
      .execute();

    return updatedLending[0];
  } catch (error) {
    console.error('Lending update failed:', error);
    throw error;
  }
}