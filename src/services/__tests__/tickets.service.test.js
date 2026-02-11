import { ticketsService } from '../tickets.service';

describe('ticketsService', () => {
  describe('getWalletPassUrl', () => {
    it('returns correct Edge Function URL with reservation_id param', () => {
      const url = ticketsService.getWalletPassUrl('abc-123');
      expect(url).toBe(
        'https://test-project.supabase.co/functions/v1/wallet-pass?reservation_id=abc-123'
      );
    });

    it('includes different reservation IDs correctly', () => {
      const url = ticketsService.getWalletPassUrl('xyz-789');
      expect(url).toContain('reservation_id=xyz-789');
    });
  });

  describe('getSession', () => {
    it('calls supabase.auth.getSession', async () => {
      const { supabase } = require('../../../src/config/supabase');
      supabase.auth.getSession.mockResolvedValueOnce({
        data: { session: { access_token: 'test-token' } },
      });

      const result = await ticketsService.getSession();
      expect(result.data.session.access_token).toBe('test-token');
      expect(supabase.auth.getSession).toHaveBeenCalled();
    });
  });
});
