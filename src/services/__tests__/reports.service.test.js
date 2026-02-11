import { reportsService } from '../reports.service';

const { supabase } = require('../../config/supabase');

describe('reportsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    supabase.auth.getUser = jest.fn().mockResolvedValue({
      data: { user: { id: 'user-1' } },
    });
    supabase.rpc = jest.fn().mockResolvedValue({ data: true });
  });

  describe('reportContent validation', () => {
    it('rejects invalid report type', async () => {
      await expect(
        reportsService.reportContent({
          reportedType: 'hacked_type',
          reportedId: 'some-id',
          reason: 'spam',
        })
      ).rejects.toThrow('Invalid report type');
    });

    it('rejects invalid reason', async () => {
      await expect(
        reportsService.reportContent({
          reportedType: 'event',
          reportedId: 'some-id',
          reason: 'not_a_valid_reason',
        })
      ).rejects.toThrow('Invalid report reason');
    });

    it('rejects details exceeding 1000 characters', async () => {
      const longDetails = 'a'.repeat(1001);
      await expect(
        reportsService.reportContent({
          reportedType: 'event',
          reportedId: 'some-id',
          reason: 'spam',
          details: longDetails,
        })
      ).rejects.toThrow('Report details cannot exceed 1000 characters');
    });

    it('accepts valid report types', async () => {
      const mockChain = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 'report-1' },
          error: null,
        }),
      };
      supabase.from = jest.fn(() => mockChain);

      const validTypes = ['event', 'user', 'message', 'free_food'];
      for (const type of validTypes) {
        await reportsService.reportContent({
          reportedType: type,
          reportedId: 'some-id',
          reason: 'spam',
        });
      }

      expect(supabase.from).toHaveBeenCalledTimes(validTypes.length);
    });

    it('requires authentication', async () => {
      supabase.auth.getUser = jest.fn().mockResolvedValue({
        data: { user: null },
      });

      await expect(
        reportsService.reportContent({
          reportedType: 'event',
          reportedId: 'some-id',
          reason: 'spam',
        })
      ).rejects.toThrow('Not authenticated');
    });
  });
});
