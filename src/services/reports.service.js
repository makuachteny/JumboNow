import { supabase } from '../config/supabase';

export const reportsService = {
  async reportContent({ reportedType, reportedId, reason, details }) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Validate report type
    const validTypes = ['event', 'user', 'message', 'free_food'];
    if (!validTypes.includes(reportedType)) {
      throw new Error('Invalid report type');
    }

    // Validate reason
    const validReasons = ['spam', 'inappropriate', 'harassment', 'misinformation', 'other'];
    if (!validReasons.includes(reason)) {
      throw new Error('Invalid report reason');
    }

    // Validate details length
    if (details && details.trim().length > 1000) {
      throw new Error('Report details cannot exceed 1000 characters');
    }

    // Rate limit: max 5 reports per hour
    const { data: allowed } = await supabase.rpc('check_rate_limit', {
      p_user_id: user.id,
      p_action: 'report',
      p_max_count: 5,
      p_window_minutes: 60,
    });

    if (allowed === false) {
      throw new Error('You have submitted too many reports recently. Please try again later.');
    }

    const { data, error } = await supabase
      .from('reports')
      .insert({
        reporter_id: user.id,
        reported_type: reportedType,
        reported_id: reportedId,
        reason,
        details: details?.trim() || null,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};
