import { supabase } from '../config/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

let _demoProfile = null;

export const authService = {
  setDemoMode(profile) {
    _demoProfile = profile;
  },

  clearDemoMode() {
    _demoProfile = null;
  },

  isDemoMode() {
    return !!_demoProfile;
  },

  async signUp({ email, password, username, graduationYear, accountType }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          graduation_year: graduationYear,
          account_type: accountType || 'student',
        },
      },
    });
    if (error) throw error;
    return data;
  },

  async signIn({ email, password }) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  },

  async signInWithSSO() {
    const { data, error } = await supabase.auth.signInWithSSO({
      domain: 'tufts.edu',
    });
    if (error) {
      if (
        error.message?.includes('No SSO provider') ||
        error.message?.includes('no SSO') ||
        error.status === 422 ||
        error.status === 404
      ) {
        throw new Error('SSO_NOT_CONFIGURED');
      }
      throw error;
    }
    return data;
  },

  async signOut() {
    if (_demoProfile) {
      _demoProfile = null;
      await AsyncStorage.removeItem('jumbonow_demo_mode');
      await AsyncStorage.removeItem('jumbonow_demo_role');
      return;
    }

    // Clean up device tokens before signing out
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('device_tokens')
          .delete()
          .eq('user_id', user.id);
      }
    } catch (_) {
      // Best-effort cleanup — don't block sign out
    }

    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async getSession() {
    if (_demoProfile) return { user: { id: _demoProfile.id, email: _demoProfile.email } };
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    return session;
  },

  async isEmailConfirmed() {
    if (_demoProfile) return true;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    return !!user.email_confirmed_at;
  },

  async resendConfirmation(email) {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
    });
    if (error) throw error;
  },

  async getCurrentProfile() {
    if (_demoProfile) return _demoProfile;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    if (error) throw error;
    return data;
  },

  async getFriendCount() {
    if (_demoProfile) return _demoProfile.account_type === 'club' ? 156 : _demoProfile.account_type === 'staff' ? 42 : 23;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 0;

    const { data, error } = await supabase.rpc('get_friend_count', {
      user_uuid: user.id,
    });
    if (error) return 0;
    return data || 0;
  },

  async updateProfile(updates) {
    if (_demoProfile) {
      Object.assign(_demoProfile, updates);
      return _demoProfile;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const ALLOWED_FIELDS = [
      'display_name', 'username', 'bio', 'graduation_year',
      'avatar_url', 'avatar_color', 'major', 'campus', 'account_type',
    ];
    const safeUpdates = {};
    for (const key of ALLOWED_FIELDS) {
      if (key in updates) {
        safeUpdates[key] = updates[key];
      }
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(safeUpdates)
      .eq('id', user.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange(callback);
  },
};
