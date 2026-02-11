import { supabase } from '../config/supabase';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export const storageService = {
  async uploadProfileImage(uri) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    const ext = (uri.split('.').pop() || 'jpg').toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      throw new Error('Invalid image format. Allowed: JPG, PNG, GIF, WebP.');
    }
    const fileName = `${user.id}/avatar.${ext}`;

    const response = await fetch(uri);
    const blob = await response.blob();

    // Check file size
    if (blob.size > MAX_FILE_SIZE) {
      throw new Error('Image is too large. Maximum size is 5MB.');
    }

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, blob, { upsert: true, contentType: `image/${ext}` });
    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName);

    // Update profile with new avatar URL
    await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', user.id);

    return publicUrl;
  },

  async deleteProfileImage() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Remove all possible extensions
    const { error } = await supabase.storage
      .from('avatars')
      .remove([
        `${user.id}/avatar.jpg`,
        `${user.id}/avatar.jpeg`,
        `${user.id}/avatar.png`,
        `${user.id}/avatar.gif`,
        `${user.id}/avatar.webp`,
      ]);
    if (error) throw error;

    await supabase
      .from('profiles')
      .update({ avatar_url: null })
      .eq('id', user.id);
  },
};
