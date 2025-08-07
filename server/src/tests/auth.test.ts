import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput, type LoginInput } from '../schema';
import { login, createUser, getUsers } from '../handlers/auth';
import { eq } from 'drizzle-orm';

// Test inputs
const testUserInput: CreateUserInput = {
  username: 'testuser',
  email: 'test@example.com',
  password: 'password123',
  role: 'staff'
};

const adminUserInput: CreateUserInput = {
  username: 'admin',
  email: 'admin@example.com',
  password: 'adminpass',
  role: 'admin'
};

const loginInput: LoginInput = {
  username: 'testuser',
  password: 'password123'
};

describe('Auth Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('createUser', () => {
    it('should create a new user with hashed password', async () => {
      const result = await createUser(testUserInput);

      expect(result.username).toEqual('testuser');
      expect(result.email).toEqual('test@example.com');
      expect(result.role).toEqual('staff');
      expect(result.id).toBeDefined();
      expect(result.password_hash).toBeDefined();
      expect(result.password_hash).not.toEqual('password123'); // Password should be hashed
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should save user to database', async () => {
      const result = await createUser(testUserInput);

      const users = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, result.id))
        .execute();

      expect(users).toHaveLength(1);
      expect(users[0].username).toEqual('testuser');
      expect(users[0].email).toEqual('test@example.com');
      expect(users[0].role).toEqual('staff');
      expect(users[0].password_hash).toBeDefined();
      expect(users[0].created_at).toBeInstanceOf(Date);
      expect(users[0].updated_at).toBeInstanceOf(Date);
    });

    it('should throw error for duplicate username', async () => {
      await createUser(testUserInput);

      const duplicateInput = {
        ...testUserInput,
        email: 'different@example.com'
      };

      await expect(createUser(duplicateInput)).rejects.toThrow(/username already exists/i);
    });

    it('should throw error for duplicate email', async () => {
      await createUser(testUserInput);

      const duplicateInput = {
        ...testUserInput,
        username: 'differentuser'
      };

      await expect(createUser(duplicateInput)).rejects.toThrow(/email already exists/i);
    });

    it('should create users with different roles', async () => {
      const managerInput: CreateUserInput = {
        username: 'manager',
        email: 'manager@example.com',
        password: 'managerpass',
        role: 'manager'
      };

      const result = await createUser(managerInput);
      expect(result.role).toEqual('manager');
    });
  });

  describe('login', () => {
    beforeEach(async () => {
      // Create a test user for login tests
      await createUser(testUserInput);
    });

    it('should authenticate valid user and return token', async () => {
      const result = await login(loginInput);

      expect(result.user).toBeDefined();
      expect(result.user.username).toEqual('testuser');
      expect(result.user.email).toEqual('test@example.com');
      expect(result.user.role).toEqual('staff');
      expect(result.token).toBeDefined();
      expect(typeof result.token).toBe('string');
      expect(result.token.length).toBeGreaterThan(0);
    });

    it('should throw error for invalid username', async () => {
      const invalidInput: LoginInput = {
        username: 'nonexistent',
        password: 'password123'
      };

      await expect(login(invalidInput)).rejects.toThrow(/invalid username or password/i);
    });

    it('should throw error for invalid password', async () => {
      const invalidInput: LoginInput = {
        username: 'testuser',
        password: 'wrongpassword'
      };

      await expect(login(invalidInput)).rejects.toThrow(/invalid username or password/i);
    });

    it('should return valid token format', async () => {
      const result = await login(loginInput);

      // Token should be base64 encoded JSON
      const decodedToken = JSON.parse(Buffer.from(result.token, 'base64').toString());
      expect(decodedToken).toHaveProperty('id');
      expect(decodedToken).toHaveProperty('username');
      expect(decodedToken).toHaveProperty('role');
      expect(decodedToken.username).toEqual('testuser');
      expect(decodedToken.role).toEqual('staff');
    });

    it('should authenticate users with different roles', async () => {
      await createUser(adminUserInput);

      const adminLogin: LoginInput = {
        username: 'admin',
        password: 'adminpass'
      };

      const result = await login(adminLogin);
      expect(result.user.role).toEqual('admin');

      const decodedToken = JSON.parse(Buffer.from(result.token, 'base64').toString());
      expect(decodedToken.role).toEqual('admin');
    });
  });

  describe('getUsers', () => {
    it('should return empty array when no users exist', async () => {
      const result = await getUsers();
      expect(result).toEqual([]);
    });

    it('should return all users', async () => {
      await createUser(testUserInput);
      await createUser(adminUserInput);

      const result = await getUsers();

      expect(result).toHaveLength(2);
      
      const usernames = result.map(user => user.username);
      expect(usernames).toContain('testuser');
      expect(usernames).toContain('admin');

      result.forEach(user => {
        expect(user.id).toBeDefined();
        expect(user.username).toBeDefined();
        expect(user.email).toBeDefined();
        expect(user.role).toBeDefined();
        expect(user.password_hash).toBeDefined();
        expect(user.created_at).toBeInstanceOf(Date);
        expect(user.updated_at).toBeInstanceOf(Date);
      });
    });

    it('should return users with correct role assignments', async () => {
      await createUser(testUserInput);
      await createUser(adminUserInput);

      const managerInput: CreateUserInput = {
        username: 'manager',
        email: 'manager@example.com',
        password: 'managerpass',
        role: 'manager'
      };
      await createUser(managerInput);

      const result = await getUsers();

      const roles = result.map(user => user.role);
      expect(roles).toContain('staff');
      expect(roles).toContain('admin');
      expect(roles).toContain('manager');
    });

    it('should return users ordered by creation', async () => {
      // Create users in sequence
      const user1 = await createUser(testUserInput);
      const user2 = await createUser(adminUserInput);

      const result = await getUsers();

      expect(result).toHaveLength(2);
      expect(result[0].id).toEqual(user1.id);
      expect(result[1].id).toEqual(user2.id);
    });
  });
});