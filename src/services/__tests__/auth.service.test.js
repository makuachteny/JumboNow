import { authService } from '../auth.service';

const { supabase } = require('../../config/supabase');

describe('authService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('signUp', () => {
    it('passes account_type in signup metadata', async () => {
      supabase.auth.signUp = jest.fn().mockResolvedValue({
        data: { user: { id: 'user-1' } },
        error: null,
      });

      await authService.signUp({
        email: 'test@tufts.edu',
        password: 'password123',
        username: 'testuser',
        graduationYear: '2027',
        accountType: 'club',
      });

      expect(supabase.auth.signUp).toHaveBeenCalledWith({
        email: 'test@tufts.edu',
        password: 'password123',
        options: {
          data: {
            username: 'testuser',
            graduation_year: '2027',
            account_type: 'club',
          },
        },
      });
    });

    it('defaults account_type to student when not provided', async () => {
      supabase.auth.signUp = jest.fn().mockResolvedValue({
        data: { user: { id: 'user-1' } },
        error: null,
      });

      await authService.signUp({
        email: 'test@tufts.edu',
        password: 'password123',
        username: 'testuser',
        graduationYear: '2027',
      });

      expect(supabase.auth.signUp).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            data: expect.objectContaining({
              account_type: 'student',
            }),
          }),
        })
      );
    });

    it('throws on signup error', async () => {
      supabase.auth.signUp = jest.fn().mockResolvedValue({
        data: null,
        error: new Error('Email already exists'),
      });

      await expect(
        authService.signUp({
          email: 'test@tufts.edu',
          password: 'pass',
          username: 'user',
        })
      ).rejects.toThrow('Email already exists');
    });
  });

  describe('updateProfile', () => {
    it('allows account_type in ALLOWED_FIELDS', async () => {
      supabase.auth.getUser = jest.fn().mockResolvedValue({
        data: { user: { id: 'user-1' } },
      });

      const mockChain = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 'user-1', account_type: 'staff' },
          error: null,
        }),
      };
      supabase.from = jest.fn(() => mockChain);

      await authService.updateProfile({ account_type: 'staff', hack_field: 'evil' });

      expect(mockChain.update).toHaveBeenCalledWith({ account_type: 'staff' });
    });

    it('strips disallowed fields from updates', async () => {
      supabase.auth.getUser = jest.fn().mockResolvedValue({
        data: { user: { id: 'user-1' } },
      });

      const mockChain = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 'user-1' },
          error: null,
        }),
      };
      supabase.from = jest.fn(() => mockChain);

      await authService.updateProfile({
        display_name: 'Test',
        is_verified: true,
        id: 'hacked-id',
        email: 'hacked@evil.com',
      });

      // Only display_name should pass through
      expect(mockChain.update).toHaveBeenCalledWith({ display_name: 'Test' });
    });
  });
});
