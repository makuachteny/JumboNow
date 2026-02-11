import { supabase } from '../config/supabase';

export const achievementsService = {
  async getAll() {
    const { data, error } = await supabase
      .from('achievements')
      .select('*')
      .order('requirement_count', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async getUserAchievements() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('user_achievements')
      .select(`
        *,
        achievement:achievements(*)
      `)
      .eq('user_id', user.id);
    if (error) throw error;
    return data || [];
  },

  async getAchievementsWithStatus() {
    const [all, unlocked] = await Promise.all([
      this.getAll(),
      this.getUserAchievements(),
    ]);

    const unlockedIds = new Set(unlocked.map((u) => u.achievement_id));

    return all.map((a) => ({
      ...a,
      unlocked: unlockedIds.has(a.id),
      unlocked_at: unlocked.find((u) => u.achievement_id === a.id)?.unlocked_at || null,
    }));
  },

  async checkAndUnlock() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.rpc('check_and_unlock_achievements', {
      p_user_id: user.id,
    });
  },

  getHardcodedAchievements() {
    return [
      {
        id: 'first_event',
        icon: '\uD83C\uDF1F',
        title: 'First Steps',
        description: 'Save your first event',
        requirement_type: 'events_saved',
        requirement_count: 1,
        unlocked: false,
      },
      {
        id: 'social_butterfly',
        icon: '\uD83E\uDD8B',
        title: 'Social Butterfly',
        description: 'Save 5 events',
        requirement_type: 'events_saved',
        requirement_count: 5,
        unlocked: false,
      },
      {
        id: 'first_ticket',
        icon: '\uD83C\uDFAB',
        title: 'Ticket Holder',
        description: 'Purchase your first ticket',
        requirement_type: 'tickets_purchased',
        requirement_count: 1,
        unlocked: false,
      },
      {
        id: 'event_explorer',
        icon: '\uD83E\uDDED',
        title: 'Explorer',
        description: 'Save 10 events',
        requirement_type: 'events_saved',
        requirement_count: 10,
        unlocked: false,
      },
      {
        id: 'campus_regular',
        icon: '\uD83C\uDFDB\uFE0F',
        title: 'Campus Regular',
        description: 'Attend 3 ticketed events',
        requirement_type: 'tickets_purchased',
        requirement_count: 3,
        unlocked: false,
      },
      {
        id: 'vip_status',
        icon: '\uD83D\uDC8E',
        title: 'VIP Status',
        description: 'Reach a vibe score of 50',
        requirement_type: 'vibe_score',
        requirement_count: 50,
        unlocked: false,
      },
      {
        id: 'event_creator',
        icon: '\uD83C\uDFA8',
        title: 'Event Creator',
        description: 'Create your first event',
        requirement_type: 'events_created',
        requirement_count: 1,
        unlocked: false,
      },
      {
        id: 'jumbo_legend',
        icon: '\uD83D\uDC18',
        title: 'Jumbo Legend',
        description: 'Save 25 events and reach vibe 80',
        requirement_type: 'events_saved',
        requirement_count: 25,
        unlocked: false,
      },
    ];
  },
};
