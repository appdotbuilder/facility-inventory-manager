import { db } from '../db';
import { usersTable } from '../db/schema';
import { type LoginInput, type CreateUserInput, type User } from '../schema';
import { eq } from 'drizzle-orm';

// Simple password hashing (in production, use bcrypt or similar)
const hashPassword = async (password: string): Promise<string> => {
  // This is a simple hash for demo purposes
  // In production, use bcrypt: const hash = await bcrypt.hash(password, 10);
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'salt');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  const inputHash = await hashPassword(password);
  return inputHash === hash;
};

// Simple JWT token generation (in production, use proper JWT library)
const generateToken = (user: User): string => {
  // This is a simple token for demo purposes
  // In production, use jsonwebtoken library
  const payload = { id: user.id, username: user.username, role: user.role };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
};

export async function login(input: LoginInput): Promise<{ user: User; token: string }> {
  try {
    // Find user by username
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.username, input.username))
      .execute();

    if (users.length === 0) {
      throw new Error('Invalid username or password');
    }

    const user = users[0];

    // Verify password
    const isValidPassword = await verifyPassword(input.password, user.password_hash);
    if (!isValidPassword) {
      throw new Error('Invalid username or password');
    }

    // Generate token
    const token = generateToken(user);

    return {
      user,
      token
    };
  } catch (error) {
    console.error('Login failed:', error);
    throw error;
  }
}

export async function createUser(input: CreateUserInput): Promise<User> {
  try {
    // Check if username already exists
    const existingUsers = await db.select()
      .from(usersTable)
      .where(eq(usersTable.username, input.username))
      .execute();

    if (existingUsers.length > 0) {
      throw new Error('Username already exists');
    }

    // Check if email already exists
    const existingEmails = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, input.email))
      .execute();

    if (existingEmails.length > 0) {
      throw new Error('Email already exists');
    }

    // Hash password
    const password_hash = await hashPassword(input.password);

    // Create user
    const result = await db.insert(usersTable)
      .values({
        username: input.username,
        email: input.email,
        password_hash,
        role: input.role
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('User creation failed:', error);
    throw error;
  }
}

export async function getUsers(): Promise<User[]> {
  try {
    const users = await db.select()
      .from(usersTable)
      .execute();

    return users;
  } catch (error) {
    console.error('Failed to fetch users:', error);
    throw error;
  }
}