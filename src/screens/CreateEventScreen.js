import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StatusBar,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Users,
  Plus,
  X,
  Check,
  ImagePlus,
} from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { eventsService } from '../services/events.service';
import { authService } from '../services/auth.service';
import { supabase } from '../config/supabase';
import { useTheme } from '../context/ThemeContext';

const EVENT_TYPES = [
  { id: 'general', label: 'General', icon: '🌀' },
  { id: 'student_org', label: 'Student Orgs', icon: '💜' },
  { id: 'arts_culture', label: 'Arts & Culture', icon: '🎭' },
  { id: 'sports', label: 'Sports', icon: '🔥' },
  { id: 'academic', label: 'Academic', icon: '💡' },
  { id: 'outdoors', label: 'Outdoors', icon: '🌿' },
  { id: 'campus_center', label: 'Campus Center', icon: '💎' },
  { id: 'greek_life', label: 'Greek Life', icon: '🏛️' },
];

const EVENT_ICONS = [
  '🎪', '🎙️', '🎷', '🎭', '🏆', '💡', '🍜', '🧃',
  '🎬', '🧘', '⚡', '🔮', '💜', '🏮', '🦋', '⛵',
  '🌿', '🎸', '🏀', '🎡', '💖', '🥂', '🎓', '🔥',
];

const GRADIENT_PRESETS = [
  { colors: ['#6AADE4', '#418FDE', '#3579C6'], primary: '#6AADE4' },
  { colors: ['#EC4899', '#F43F5E', '#DC2626'], primary: '#EC4899' },
  { colors: ['#A78BFA', '#8B5CF6', '#D946EF'], primary: '#A78BFA' },
  { colors: ['#34D399', '#10B981', '#059669'], primary: '#34D399' },
  { colors: ['#FACC15', '#F59E0B', '#D97706'], primary: '#FACC15' },
  { colors: ['#F97316', '#EA580C', '#C2410C'], primary: '#F97316' },
  { colors: ['#EF4444', '#DC2626', '#B91C1C'], primary: '#EF4444' },
  { colors: ['#6366F1', '#4F46E5', '#4338CA'], primary: '#6366F1' },
];

export default function CreateEventScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const editEvent = route?.params?.editEvent || null;
  const isEditing = !!editEvent;

  // Find gradient index by primary color
  const findGradientIndex = (color) => {
    const idx = GRADIENT_PRESETS.findIndex((g) => g.primary === color);
    return idx >= 0 ? idx : 0;
  };

  // Form state
  const [title, setTitle] = useState(editEvent?.title || '');
  const [subtitle, setSubtitle] = useState(editEvent?.subtitle || '');
  const [description, setDescription] = useState(editEvent?.description || '');
  const [eventType, setEventType] = useState(editEvent?.event_type || 'general');
  const [location, setLocation] = useState(editEvent?.location || '');
  const [startDateTime, setStartDateTime] = useState(editEvent ? new Date(editEvent.start_time) : null);
  const [endDateTime, setEndDateTime] = useState(editEvent ? new Date(editEvent.end_time) : null);
  const [activePicker, setActivePicker] = useState(null);
  const [maxCapacity, setMaxCapacity] = useState(editEvent?.max_capacity?.toString() || '100');
  const [selectedIcon, setSelectedIcon] = useState(editEvent?.icon || '\uD83C\uDF89');
  const [selectedGradient, setSelectedGradient] = useState(editEvent ? findGradientIndex(editEvent.color) : 0);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState(editEvent?.tags || []);
  const [organizerName, setOrganizerName] = useState(editEvent?.organizer_name || '');
  const [isFeatured, setIsFeatured] = useState(editEvent?.is_featured || false);
  const [posterImage, setPosterImage] = useState(editEvent?.image_url || null);
  const [accountType, setAccountType] = useState('student');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    authService.getCurrentProfile().then((profile) => {
      if (profile?.account_type) setAccountType(profile.account_type);
    }).catch(() => {});
  }, []);

  const formatDisplayDate = (date) => {
    if (!date) return '';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatDisplayTime = (date) => {
    if (!date) return '';
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const handleDateChange = (event, selectedDate, field) => {
    if (Platform.OS === 'android') {
      setActivePicker(null);
    }
    if (!selectedDate || event.type === 'dismissed') return;

    if (field === 'startDate' || field === 'startTime') {
      setStartDateTime((prev) => {
        const d = prev ? new Date(prev) : new Date();
        if (field === 'startDate') {
          d.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
        } else {
          d.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
        }
        return d;
      });
    } else {
      setEndDateTime((prev) => {
        const d = prev ? new Date(prev) : new Date();
        if (field === 'endDate') {
          d.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
        } else {
          d.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
        }
        return d;
      });
    }
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
      setTagInput('');
    }
  };

  const removeTag = (tag) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow photo library access to add a poster.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]) {
      setPosterImage(result.assets[0].uri);
    }
  };

  const uploadPoster = async (localUri) => {
    const ext = localUri.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `event-posters/${Date.now()}.${ext}`;
    const response = await fetch(localUri);
    const blob = await response.blob();

    const { error } = await supabase.storage
      .from('event-images')
      .upload(fileName, blob, { contentType: `image/${ext}`, upsert: false });
    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from('event-images')
      .getPublicUrl(fileName);
    return urlData.publicUrl;
  };

  const handleCreate = async () => {
    // Validation
    if (!title.trim()) {
      Alert.alert('Missing Title', 'Please enter an event title.');
      return;
    }
    if (!location.trim()) {
      Alert.alert('Missing Location', 'Please enter a location.');
      return;
    }

    if (!startDateTime) {
      Alert.alert('Missing Start', 'Please select a start date and time.');
      return;
    }
    if (!endDateTime) {
      Alert.alert('Missing End', 'Please select an end date and time.');
      return;
    }
    const start = startDateTime;
    const end = endDateTime;
    if (end <= start) {
      Alert.alert('Invalid Dates', 'End time must be after start time.');
      return;
    }
    if (start < new Date()) {
      Alert.alert('Invalid Date', 'Start time must be in the future.');
      return;
    }

    const gradient = GRADIENT_PRESETS[selectedGradient];
    const capacity = parseInt(maxCapacity) || 100;

    // Upload poster image if selected
    let imageUrl = null;
    if (posterImage) {
      try {
        imageUrl = await uploadPoster(posterImage);
      } catch (uploadErr) {
        Alert.alert('Image Upload Failed', 'Could not upload poster. The event will be created without it.');
      }
    }

    const eventData = {
      title: title.trim(),
      subtitle: subtitle.trim() || organizerName.trim() || null,
      description: description.trim() || null,
      icon: selectedIcon,
      color: gradient.primary,
      gradient_colors: gradient.colors,
      category: eventType === 'academic' ? 'Study' : eventType === 'arts_culture' ? 'Arts' : eventType === 'sports' ? 'Sports' : 'General',
      location: location.trim(),
      distance: '0.3 mi',
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      max_capacity: capacity,
      tags,
      energy: 70,
      vibe: '🎪 Fun',
      event_type: eventType,
      organizer_name: organizerName.trim() || null,
      organizer_icon: selectedIcon,
      ticket_price: 0,
      requires_reservation: true,
      is_featured: isFeatured,
      ticket_types: [],
      image_url: imageUrl,
      visibility: accountType === 'student' ? 'friends_only' : 'public',
    };

    setCreating(true);
    try {
      if (isEditing) {
        const updated = await eventsService.updateEvent(editEvent.id, eventData);
        Alert.alert(
          'Event Updated!',
          `"${updated.title}" has been updated.`,
          [{ text: 'View Event', onPress: () => navigation.replace('EventDetail', { eventId: updated.id }) }],
        );
      } else {
        const created = await eventsService.createEvent(eventData);
        Alert.alert(
          'Event Created!',
          `"${created.title}" is now live. People can find it and sign up.`,
          [{ text: 'View Event', onPress: () => navigation.replace('EventDetail', { eventId: created.id }) }],
        );
      }
    } catch (err) {
      Alert.alert('Error', err.message || `Failed to ${isEditing ? 'update' : 'create'} event.`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle={colors.statusBarStyle} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft size={22} color={colors.accent} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEditing ? 'Edit Event' : 'Create Event'}</Text>
        <View style={{ width: 42 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 40, paddingHorizontal: 16 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Preview Banner */}
          <View style={[styles.previewBanner, posterImage ? styles.previewBannerWithImage : null, { backgroundColor: GRADIENT_PRESETS[selectedGradient].primary }]}>
            {posterImage ? (
              <>
                <Image source={{ uri: posterImage }} style={styles.previewPoster} resizeMode="cover" />
                <View style={styles.previewOverlay} />
              </>
            ) : null}
            <Text style={styles.previewIcon}>{selectedIcon}</Text>
            <Text style={styles.previewTitle}>{title || 'Your Event'}</Text>
            <Text style={styles.previewSub}>{subtitle || organizerName || 'Organizer'}</Text>
          </View>

          {/* Section: Basic Info */}
          <Text style={styles.sectionLabel}>Basic Info</Text>

          <Text style={styles.inputLabel}>Event Title *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Spring Fling 2026"
            placeholderTextColor={colors.placeholder}
            value={title}
            onChangeText={setTitle}
            maxLength={100}
          />

          <Text style={styles.inputLabel}>Subtitle</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Annual Celebration"
            placeholderTextColor={colors.placeholder}
            value={subtitle}
            onChangeText={setSubtitle}
            maxLength={100}
          />

          <Text style={styles.inputLabel}>Description</Text>
          <TextInput
            style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
            placeholder="Describe your event..."
            placeholderTextColor={colors.placeholder}
            value={description}
            onChangeText={setDescription}
            multiline
            maxLength={1000}
          />
          <Text style={styles.charCount}>{description.length}/1000</Text>

          <Text style={styles.inputLabel}>Organizer Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Tufts Student Government"
            placeholderTextColor={colors.placeholder}
            value={organizerName}
            onChangeText={setOrganizerName}
          />

          {/* Section: Event Poster */}
          <Text style={styles.sectionLabel}>Event Poster</Text>
          <TouchableOpacity style={styles.posterPicker} onPress={pickImage}>
            {posterImage ? (
              <View style={styles.posterPreviewWrap}>
                <Image source={{ uri: posterImage }} style={styles.posterPreview} />
                <TouchableOpacity style={styles.posterRemove} onPress={() => setPosterImage(null)}>
                  <X size={14} color="#FFF" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.posterPlaceholder}>
                <ImagePlus size={28} color={colors.accentMuted} />
                <Text style={styles.posterPlaceholderText}>Tap to add a poster image</Text>
                <Text style={styles.posterHint}>Recommended: 16:9 ratio</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Section: Event Type */}
          <Text style={styles.sectionLabel}>Event Type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeRow}>
            {EVENT_TYPES.map((type) => (
              <TouchableOpacity
                key={type.id}
                style={[styles.typeChip, eventType === type.id && styles.typeChipActive]}
                onPress={() => setEventType(type.id)}
              >
                <Text style={styles.typeIcon}>{type.icon}</Text>
                <Text style={[styles.typeText, eventType === type.id && styles.typeTextActive]}>
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Section: Icon & Color */}
          <Text style={styles.sectionLabel}>Event Icon</Text>
          <View style={styles.iconGrid}>
            {EVENT_ICONS.map((icon) => (
              <TouchableOpacity
                key={icon}
                style={[styles.iconOption, selectedIcon === icon && styles.iconOptionSelected]}
                onPress={() => setSelectedIcon(icon)}
              >
                <Text style={styles.iconText}>{icon}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.sectionLabel}>Event Color</Text>
          <View style={styles.colorRow}>
            {GRADIENT_PRESETS.map((g, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.colorOption, { backgroundColor: g.primary }, selectedGradient === i && styles.colorOptionSelected]}
                onPress={() => setSelectedGradient(i)}
              >
                {selectedGradient === i && <Check size={16} color="#FFF" />}
              </TouchableOpacity>
            ))}
          </View>

          {/* Section: When & Where */}
          <Text style={styles.sectionLabel}>When & Where</Text>

          <Text style={styles.inputLabel}>Location *</Text>
          <View style={styles.inputRow}>
            <MapPin size={16} color={colors.accentMuted} />
            <TextInput
              style={styles.inputInRow}
              placeholder="e.g. Cohen Auditorium"
              placeholderTextColor={colors.placeholder}
              value={location}
              onChangeText={setLocation}
            />
          </View>

          <View style={styles.dateRow}>
            <View style={styles.dateCol}>
              <Text style={styles.inputLabel}>Start Date *</Text>
              <TouchableOpacity
                style={styles.inputRow}
                onPress={() => setActivePicker(activePicker === 'startDate' ? null : 'startDate')}
              >
                <Calendar size={14} color={colors.accentMuted} />
                <Text style={[styles.pickerText, !startDateTime && { color: colors.placeholder }]}>
                  {startDateTime ? formatDisplayDate(startDateTime) : 'Select date'}
                </Text>
              </TouchableOpacity>
              {activePicker === 'startDate' && (
                <DateTimePicker
                  value={startDateTime || new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(e, d) => handleDateChange(e, d, 'startDate')}
                  minimumDate={new Date()}
                  style={Platform.OS === 'ios' ? { height: 150 } : undefined}
                />
              )}
            </View>
            <View style={styles.dateCol}>
              <Text style={styles.inputLabel}>Start Time *</Text>
              <TouchableOpacity
                style={styles.inputRow}
                onPress={() => setActivePicker(activePicker === 'startTime' ? null : 'startTime')}
              >
                <Clock size={14} color={colors.accentMuted} />
                <Text style={[styles.pickerText, !startDateTime && { color: colors.placeholder }]}>
                  {startDateTime ? formatDisplayTime(startDateTime) : 'Select time'}
                </Text>
              </TouchableOpacity>
              {activePicker === 'startTime' && (
                <DateTimePicker
                  value={startDateTime || new Date()}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(e, d) => handleDateChange(e, d, 'startTime')}
                  style={Platform.OS === 'ios' ? { height: 150 } : undefined}
                />
              )}
            </View>
          </View>

          <View style={styles.dateRow}>
            <View style={styles.dateCol}>
              <Text style={styles.inputLabel}>End Date *</Text>
              <TouchableOpacity
                style={styles.inputRow}
                onPress={() => setActivePicker(activePicker === 'endDate' ? null : 'endDate')}
              >
                <Calendar size={14} color={colors.accentMuted} />
                <Text style={[styles.pickerText, !endDateTime && { color: colors.placeholder }]}>
                  {endDateTime ? formatDisplayDate(endDateTime) : 'Select date'}
                </Text>
              </TouchableOpacity>
              {activePicker === 'endDate' && (
                <DateTimePicker
                  value={endDateTime || new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(e, d) => handleDateChange(e, d, 'endDate')}
                  minimumDate={startDateTime || new Date()}
                  style={Platform.OS === 'ios' ? { height: 150 } : undefined}
                />
              )}
            </View>
            <View style={styles.dateCol}>
              <Text style={styles.inputLabel}>End Time *</Text>
              <TouchableOpacity
                style={styles.inputRow}
                onPress={() => setActivePicker(activePicker === 'endTime' ? null : 'endTime')}
              >
                <Clock size={14} color={colors.accentMuted} />
                <Text style={[styles.pickerText, !endDateTime && { color: colors.placeholder }]}>
                  {endDateTime ? formatDisplayTime(endDateTime) : 'Select time'}
                </Text>
              </TouchableOpacity>
              {activePicker === 'endTime' && (
                <DateTimePicker
                  value={endDateTime || new Date()}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(e, d) => handleDateChange(e, d, 'endTime')}
                  style={Platform.OS === 'ios' ? { height: 150 } : undefined}
                />
              )}
            </View>
          </View>

          {/* Done button for iOS pickers */}
          {Platform.OS === 'ios' && activePicker && (
            <TouchableOpacity
              style={styles.pickerDoneBtn}
              onPress={() => setActivePicker(null)}
            >
              <Text style={styles.pickerDoneText}>Done</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.inputLabel}>Max Capacity</Text>
          <View style={styles.inputRow}>
            <Users size={16} color={colors.accentMuted} />
            <TextInput
              style={styles.inputInRow}
              placeholder="100"
              placeholderTextColor={colors.placeholder}
              value={maxCapacity}
              onChangeText={setMaxCapacity}
              keyboardType="number-pad"
              maxLength={5}
            />
          </View>

          {/* Section: Pricing - Paid events disabled until payment integration */}
          <Text style={styles.sectionLabel}>Pricing</Text>
          <View style={[styles.toggleOption, styles.toggleOptionActive, { marginBottom: 8 }]}>
            <Text style={[styles.toggleText, styles.toggleTextActive]}>Free Event</Text>
          </View>
          <Text style={styles.hintText}>Paid events will be available once payment processing is integrated.</Text>

          {/* Visibility Info */}
          {accountType === 'student' && (
            <View style={styles.visibilityInfo}>
              <Text style={styles.visibilityInfoIcon}>🔒</Text>
              <Text style={styles.visibilityInfoText}>Your event will only be visible to your friends.</Text>
            </View>
          )}

          {/* Section: Tags */}
          <Text style={styles.sectionLabel}>Tags</Text>
          <View style={styles.tagInputRow}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              placeholder="Add a tag (e.g. Free Food)"
              placeholderTextColor={colors.placeholder}
              value={tagInput}
              onChangeText={setTagInput}
              onSubmitEditing={addTag}
              returnKeyType="done"
            />
            <TouchableOpacity style={styles.addTagBtn} onPress={addTag}>
              <Plus size={18} color="#FFF" />
            </TouchableOpacity>
          </View>
          {tags.length > 0 && (
            <View style={styles.tagsRow}>
              {tags.map((tag) => (
                <TouchableOpacity key={tag} style={styles.tagChip} onPress={() => removeTag(tag)}>
                  <Text style={styles.tagChipText}>{tag}</Text>
                  <X size={12} color={colors.accent} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Featured Toggle */}
          <TouchableOpacity
            style={[styles.featuredToggle, isFeatured && styles.featuredToggleActive]}
            onPress={() => setIsFeatured(!isFeatured)}
          >
            <Text style={[styles.featuredToggleText, isFeatured && styles.featuredToggleTextActive]}>
              {isFeatured ? '💫 Featured Event' : 'Mark as Featured'}
            </Text>
          </TouchableOpacity>

          {/* Create Button */}
          <TouchableOpacity
            style={[styles.createButton, creating && { opacity: 0.6 }]}
            onPress={handleCreate}
            disabled={creating}
          >
            {creating ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <>
                <Check size={20} color="#FFF" />
                <Text style={styles.createButtonText}>{isEditing ? 'Update Event' : 'Create Event'}</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.accentBorder },
  backButton: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.cardBorder },
  headerTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  previewBanner: { borderRadius: 20, padding: 20, marginTop: 16, marginBottom: 20, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  previewBannerWithImage: { minHeight: 220 },
  previewPoster: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  previewOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' },
  previewIcon: { fontSize: 48, marginBottom: 8, zIndex: 1 },
  previewTitle: { color: '#FFF', fontSize: 20, fontWeight: '900', textAlign: 'center', marginBottom: 4, zIndex: 1 },
  previewSub: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600', zIndex: 1 },
  posterPicker: { marginBottom: 8 },
  posterPreviewWrap: { borderRadius: 16, overflow: 'hidden', height: 180 },
  posterPreview: { width: '100%', height: '100%' },
  posterRemove: { position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  posterPlaceholder: { alignItems: 'center', justifyContent: 'center', height: 120, borderRadius: 16, borderWidth: 2, borderColor: colors.accentBorder, borderStyle: 'dashed', backgroundColor: colors.card, gap: 6 },
  posterPlaceholderText: { color: colors.textTertiary, fontSize: 13, fontWeight: '600' },
  posterHint: { color: colors.accentMuted, fontSize: 11 },
  sectionLabel: { color: colors.text, fontSize: 16, fontWeight: '800', marginTop: 20, marginBottom: 10 },
  inputLabel: { color: colors.textTertiary, fontSize: 12, fontWeight: '700', marginBottom: 6, marginTop: 8 },
  input: { backgroundColor: colors.inputBg, borderRadius: 14, padding: 14, color: colors.text, fontSize: 14, borderWidth: 1, borderColor: colors.accentBorder, marginBottom: 8 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.inputBg, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: colors.accentBorder, marginBottom: 8 },
  inputInRow: { flex: 1, color: colors.text, fontSize: 14 },
  charCount: { color: colors.accentMuted, fontSize: 11, textAlign: 'right', marginTop: -4, marginBottom: 8 },
  typeRow: { gap: 8, paddingBottom: 4 },
  typeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder },
  typeChipActive: { backgroundColor: colors.accentBg, borderColor: colors.accentBorder },
  typeIcon: { fontSize: 16 },
  typeText: { color: colors.textTertiary, fontSize: 12, fontWeight: '700' },
  typeTextActive: { color: colors.accent },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  iconOption: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card, borderWidth: 2, borderColor: colors.cardBorder },
  iconOptionSelected: { borderColor: colors.accent, backgroundColor: colors.accentBg },
  iconText: { fontSize: 22 },
  colorRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  colorOption: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  colorOptionSelected: { borderColor: colors.text, borderWidth: 3 },
  dateRow: { flexDirection: 'row', gap: 10 },
  dateCol: { flex: 1 },
  pickerText: { flex: 1, color: colors.text, fontSize: 14 },
  pickerDoneBtn: { alignSelf: 'flex-end', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.accentBg, marginBottom: 8 },
  pickerDoneText: { color: colors.accent, fontSize: 14, fontWeight: '700' },
  toggleRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  toggleOption: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder },
  toggleOptionActive: { backgroundColor: colors.accentBg, borderColor: colors.accentBorder },
  toggleText: { color: colors.textTertiary, fontSize: 14, fontWeight: '700' },
  toggleTextActive: { color: colors.accent },
  hintText: { color: colors.textMuted, fontSize: 11, marginBottom: 8 },
  visibilityInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, backgroundColor: 'rgba(139,92,246,0.1)', borderWidth: 1, borderColor: 'rgba(139,92,246,0.2)', marginTop: 12, marginBottom: 4 },
  visibilityInfoIcon: { fontSize: 16 },
  visibilityInfoText: { color: '#8B5CF6', fontSize: 12, fontWeight: '600', flex: 1 },
  ticketTypeRow: { flexDirection: 'row', alignItems: 'center', padding: 12, marginBottom: 6, borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder },
  ticketTypeName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  ticketTypeMeta: { color: colors.textTertiary, fontSize: 12, marginTop: 2 },
  removeBtn: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.error + '15' },
  addTicketRow: { flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 4 },
  addTicketBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: colors.buttonPrimary, alignItems: 'center', justifyContent: 'center' },
  tagInputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  addTagBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: colors.buttonPrimary, alignItems: 'center', justifyContent: 'center' },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  tagChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: colors.accentBg, borderWidth: 1, borderColor: colors.accentBorder },
  tagChipText: { color: colors.accent, fontSize: 12, fontWeight: '600' },
  featuredToggle: { alignItems: 'center', paddingVertical: 14, borderRadius: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, marginTop: 20 },
  featuredToggleActive: { backgroundColor: 'rgba(250,204,21,0.1)', borderColor: 'rgba(250,204,21,0.3)' },
  featuredToggleText: { color: colors.textTertiary, fontSize: 14, fontWeight: '700' },
  featuredToggleTextActive: { color: '#FACC15' },
  createButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 18, borderRadius: 16, backgroundColor: colors.buttonPrimary, marginTop: 20 },
  createButtonText: { color: '#FFF', fontSize: 17, fontWeight: '900' },
});
