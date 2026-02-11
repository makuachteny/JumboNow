import { eventsService } from '../events.service';

const { supabase } = require('../../config/supabase');

describe('eventsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getFriendsEvents', () => {
    it('returns empty array when RPC does not exist', async () => {
      supabase.rpc = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'function get_friends_event_ids does not exist', code: '42883' },
      });

      const result = await eventsService.getFriendsEvents({ page: 0 });
      expect(result).toEqual([]);
    });

    it('returns empty array when no friends events found', async () => {
      supabase.rpc = jest.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await eventsService.getFriendsEvents({ page: 0 });
      expect(result).toEqual([]);
    });
  });

  describe('createEvent', () => {
    it('retries without visibility when column does not exist', async () => {
      supabase.auth.getUser = jest.fn().mockResolvedValue({
        data: { user: { id: 'user-1' } },
      });
      supabase.rpc = jest.fn().mockResolvedValue({ data: true });

      let callCount = 0;
      const mockChain = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve({
              data: null,
              error: { message: 'column "visibility" does not exist', code: '42703' },
            });
          }
          return Promise.resolve({
            data: { id: 'event-1', title: 'Test Event' },
            error: null,
          });
        }),
      };
      supabase.from = jest.fn(() => mockChain);

      const result = await eventsService.createEvent({
        title: 'Test Event',
        visibility: 'friends_only',
      });

      expect(result).toEqual({ id: 'event-1', title: 'Test Event' });
      // Should have been called twice: once with visibility, once without
      expect(mockChain.insert).toHaveBeenCalledTimes(2);
    });
  });

  describe('searchEvents sanitization', () => {
    it('sanitizes commas and parentheses from search query in fallback path', async () => {
      supabase.auth = { getUser: jest.fn() };

      // First call (textSearch) fails to trigger fallback
      let orFilterArg = '';
      const mockChain = {
        select: jest.fn().mockReturnThis(),
        textSearch: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockImplementation(function () {
          return Promise.resolve({
            data: null,
            error: { message: 'search_vector does not exist' },
          });
        }),
        or: jest.fn().mockImplementation(function (filter) {
          orFilterArg = filter;
          return this;
        }),
      };

      // Override range on the fallback chain to succeed
      const mockChain2 = {
        ...mockChain,
        range: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      };

      let callNum = 0;
      supabase.from = jest.fn(() => {
        callNum++;
        return callNum <= 1 ? mockChain : mockChain2;
      });

      await eventsService.searchEvents('test,hack()evil');

      // The commas and parens should be stripped from the pattern
      expect(orFilterArg).toContain('%testhackevil%');
      expect(orFilterArg).not.toContain(',hack');
    });
  });
});
