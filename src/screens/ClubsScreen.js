import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ScrollView,
  TextInput,
  StatusBar,
  Alert,
  Animated,
  Linking,
  Modal,
  Image,
  LayoutAnimation,
  Platform,
  UIManager,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft,
  Search,
  X,
  Check,
  Users,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Camera,
  Palette,
  FileText,
  Settings,
  Image as ImageIcon,
  Link,
  Instagram,
  Globe,
  Clock,
  UserPlus,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import BottomNav from '../components/BottomNav';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const JOINED_CLUBS_KEY = 'jumbonow_joined_clubs';
const CLUB_PROFILES_KEY = 'jumbonow_club_profiles';
const CLUB_REQUESTS_KEY = 'jumbonow_club_requests';

const BRAND_COLORS = [
  '#163D6B', '#6AADE4', '#418FDE', '#EF4444', '#F59E0B',
  '#22C55E', '#3579C6', '#2B6CB0', '#14B8A6', '#F97316',
  '#3B82F6', '#1E5A9E', '#0EA5E9', '#84CC16', '#7EC4F0',
];

const MOCK_REQUESTERS = [
  { name: 'Alex Chen', message: 'I\'ve been passionate about this since freshman year and would love to get involved!' },
  { name: 'Jordan Williams', message: 'A friend recommended this club. Excited to contribute and meet new people.' },
  { name: 'Sam Patel', message: 'Looking to expand my horizons and join a great community on campus.' },
];

const CLUB_CATEGORIES = [
  { id: 'all', label: 'All', emoji: '\u{1F300}' },
  { id: 'cultural', label: 'Cultural & Identity', emoji: '\u{1F30D}' },
  { id: 'arts', label: 'Arts & Performance', emoji: '\u{1F3AD}' },
  { id: 'media', label: 'Media & Publications', emoji: '\u{1F4F0}' },
  { id: 'stem', label: 'Engineering & STEM', emoji: '\u{1F52C}' },
  { id: 'service', label: 'Service & Activism', emoji: '\u{1F91D}' },
  { id: 'academic', label: 'Pre-Professional', emoji: '\u{1F4DA}' },
  { id: 'sports', label: 'Sports & Recreation', emoji: '\u{26BD}' },
  { id: 'religious', label: 'Religious & Spiritual', emoji: '\u{1F54A}\uFE0F' },
  { id: 'political', label: 'Political & Advocacy', emoji: '\u{1F5F3}\uFE0F' },
  { id: 'social', label: 'Social & Programming', emoji: '\u{1F389}' },
  { id: 'greek', label: 'Greek Life', emoji: '\u{1F3DB}\uFE0F' },
];

const ALL_CLUBS = [
  // Cultural & Identity
  { id: 'aafro', name: 'African American Foundations & Roots Org (AAFRO)', category: 'cultural', members: 85 },
  { id: 'aso', name: 'African Student Organization (ASO)', category: 'cultural', members: 72 },
  { id: 'ampt', name: 'Association of Multiracial People at Tufts', category: 'cultural', members: 45 },
  { id: 'bsa', name: 'Brazilian Student Association', category: 'cultural', members: 38 },
  { id: 'bsu', name: 'Black Student Union', category: 'cultural', members: 120 },
  { id: 'bwc', name: "Black Women's Collective", category: 'cultural', members: 55 },
  { id: 'cso', name: 'Caribbean Student Organization', category: 'cultural', members: 42 },
  { id: 'csa', name: 'Chinese Student Association', category: 'cultural', members: 95 },
  { id: 'fsu', name: 'Filipino Student Union', category: 'cultural', members: 48 },
  { id: 'hsa', name: 'Haitian Student Alliance', category: 'cultural', members: 35 },
  { id: 'isa', name: 'Indian Student Association', category: 'cultural', members: 88 },
  { id: 'ita', name: 'Italian Tufts Association', category: 'cultural', members: 30 },
  { id: 'jcc', name: 'Japanese Culture Club', category: 'cultural', members: 62 },
  { id: 'ksa', name: 'Korean Student Association', category: 'cultural', members: 78 },
  { id: 'lat_com', name: 'Latin American Committee', category: 'cultural', members: 65 },
  { id: 'mcc', name: 'Mexican Culture Club', category: 'cultural', members: 40 },
  { id: 'merg', name: 'Middle East Research Group (MERG)', category: 'cultural', members: 52 },
  { id: 'paa', name: 'Pan-Afrikan Alliance (PAA)', category: 'cultural', members: 70 },
  { id: 'sarc', name: 'South Asian Regional Committee (SARC)', category: 'cultural', members: 58 },
  { id: 'squad', name: "Students' Quest for Unity in the African Diaspora", category: 'cultural', members: 48 },
  { id: 'tasa', name: 'Tufts Association of South Asians (TASA)', category: 'cultural', members: 110 },
  { id: 'hksa', name: 'Hong Kong Student Association', category: 'cultural', members: 44 },
  { id: 'slavic', name: 'Slavic & East European Association', category: 'cultural', members: 25 },
  { id: 'french_soc', name: 'French Society', category: 'cultural', members: 32 },
  { id: 'spanish_table', name: 'Spanish Conversation Table', category: 'cultural', members: 28 },

  // Arts & Performance
  { id: 'cheap_sox', name: 'Cheap Sox (Improv)', category: 'arts', members: 18 },
  { id: 'major_undecided', name: 'Major: Undecided (Sketch Comedy)', category: 'arts', members: 22 },
  { id: 'ttt', name: 'Traveling Treasure Trunk (Theater)', category: 'arts', members: 30 },
  { id: 'torn_ticket', name: 'Torn Ticket II (Musical Theater)', category: 'arts', members: 45 },
  { id: '3ps', name: '3Ps \u2014 Pen, Paints & Pretzels', category: 'arts', members: 55 },
  { id: 'encendido', name: 'Encendido (Latin Dance)', category: 'arts', members: 35 },
  { id: 'ballroom', name: 'Ballroom Dance', category: 'arts', members: 40 },
  { id: 'sarabande', name: 'Sarabande (Dance)', category: 'arts', members: 28 },
  { id: 'spirit_creative', name: 'Spirit of the Creative (Hip-Hop Dance)', category: 'arts', members: 32 },
  { id: 'blackout', name: 'BlackOut (Step Team)', category: 'arts', members: 20 },
  { id: 'envy', name: 'ENVY (Step Team)', category: 'arts', members: 18 },
  { id: 'corps_ballet', name: 'Tufts Corps de Ballet', category: 'arts', members: 24 },
  { id: 'pole_dance', name: 'Pole Dance Collective', category: 'arts', members: 22 },
  { id: 'standup', name: 'Stand Up Comedy Collective', category: 'arts', members: 15 },
  { id: 'essence', name: 'Essence (A Cappella)', category: 'arts', members: 16 },
  { id: 's_factor', name: 'S-Factor (A Cappella)', category: 'arts', members: 16 },
  { id: 'hype_mimez', name: 'Hype Mimez', category: 'arts', members: 14 },
  { id: 'calligraphy', name: 'Tufts Calligraphy Club', category: 'arts', members: 30 },
  { id: 'music_prod', name: 'Music Production Club', category: 'arts', members: 25 },
  { id: 'fiber_arts', name: 'SMFA Fiber Arts Club', category: 'arts', members: 20 },
  { id: 'graphic_novel', name: 'SMFA Graphic Novel Club', category: 'arts', members: 18 },

  // Media & Publications
  { id: 'daily', name: 'The Tufts Daily', category: 'media', members: 80 },
  { id: 'observer', name: 'The Tufts Observer', category: 'media', members: 45 },
  { id: 'zamboni', name: 'Zamboni (Humor Magazine)', category: 'media', members: 25 },
  { id: 'primary_source', name: 'The Primary Source', category: 'media', members: 20 },
  { id: 'onyx', name: 'ONYX Magazine', category: 'media', members: 18 },
  { id: 'hemispheres', name: 'Hemispheres (Journal)', category: 'media', members: 22 },
  { id: 'hist_review', name: 'Tufts Historical Review', category: 'media', members: 15 },
  { id: 'tulr', name: 'Tufts Undergraduate Law Review (TULR)', category: 'media', members: 30 },
  { id: 'lantern', name: 'The Lantern', category: 'media', members: 12 },
  { id: 'palmier', name: 'Palmier (Writers)', category: 'media', members: 20 },

  // Engineering & STEM
  { id: 'aiche', name: 'American Institute of Chemical Engineers (AIChE)', category: 'stem', members: 42 },
  { id: 'asce', name: 'American Society of Civil Engineers (ASCE)', category: 'stem', members: 38 },
  { id: 'asme', name: 'American Society of Mechanical Engineers (ASME)', category: 'stem', members: 55 },
  { id: 'bmes', name: 'Biomedical Engineering Society (BMES)', category: 'stem', members: 65 },
  { id: 'beaches', name: 'BEaCHES (Biomedical & Chemical Engineering)', category: 'stem', members: 30 },
  { id: 'ieee', name: 'IEEE (Electrical & Electronics Engineers)', category: 'stem', members: 48 },
  { id: 'jumbocode', name: 'JumboCode', category: 'stem', members: 95 },
  { id: 'tufts_make', name: 'Tufts MAKE', category: 'stem', members: 40 },
  { id: 'robotics', name: 'Tufts Robotics Club', category: 'stem', members: 55 },
  { id: 'seds', name: 'Students for Exploration & Development of Space', category: 'stem', members: 35 },
  { id: 'swe', name: 'Society of Women Engineers (SWE)', category: 'stem', members: 78 },
  { id: 'wics', name: 'Women in Computer Science (WiCS)', category: 'stem', members: 65 },
  { id: 'nsbe', name: 'National Society of Black Engineers (NSBE)', category: 'stem', members: 42 },
  { id: 'ostem', name: 'oSTEM (LGBTQ+ in STEM)', category: 'stem', members: 30 },
  { id: 'tau_beta_pi', name: 'Tau Beta Pi (Engineering Honor Society)', category: 'stem', members: 50 },
  { id: 'stomp', name: 'STOMP (Student Teacher Outreach Mentorship)', category: 'stem', members: 45 },
  { id: 'ewb', name: 'Engineers Without Borders', category: 'stem', members: 60 },
  { id: 'soles', name: 'Society of Latinx Engineers & Scientists (SOLES)', category: 'stem', members: 35 },
  { id: 'electric_racing', name: 'Electric Racing', category: 'stem', members: 28 },
  { id: 'csx', name: 'Tufts Computer Science Exchange', category: 'stem', members: 70 },
  { id: 'ai_society', name: 'AI Society', category: 'stem', members: 82 },
  { id: 'ai_safety', name: 'Tufts AI Safety', category: 'stem', members: 38 },
  { id: 'biotech', name: 'Tufts Biotech Club', category: 'stem', members: 42 },
  { id: 'girls_stem', name: 'Girls in STEM', category: 'stem', members: 45 },
  { id: 'biomechanics', name: 'Tufts Biomechanics', category: 'stem', members: 22 },
  { id: 'cheme_car', name: 'ChemE Car', category: 'stem', members: 18 },
  { id: 'hfes', name: 'Human Factors & Ergonomics Society', category: 'stem', members: 20 },

  // Service & Activism
  { id: 'lcs', name: 'Leonard Carmichael Society', category: 'service', members: 150 },
  { id: 'amnesty', name: 'Amnesty International', category: 'service', members: 55 },
  { id: 'h4h', name: 'Habitat for Humanity', category: 'service', members: 65 },
  { id: 'jumbovote', name: 'JumboVote', category: 'service', members: 40 },
  { id: 'jfn', name: 'Jumbos for Nonprofits', category: 'service', members: 35 },
  { id: 'prison_justice', name: 'Tufts Prison Justice', category: 'service', members: 28 },
  { id: 'active_minds', name: 'Active Minds (Mental Health)', category: 'service', members: 48 },
  { id: 'love146', name: 'Love146 (Anti-Trafficking)', category: 'service', members: 25 },
  { id: 'thirst', name: 'Tufts Thirst Project (Clean Water)', category: 'service', members: 30 },
  { id: 'hooked', name: 'Hooked (Education)', category: 'service', members: 22 },
  { id: 'petey_greene', name: 'The Petey Greene Program', category: 'service', members: 35 },
  { id: 'legacy', name: 'The Legacy Project', category: 'service', members: 20 },
  { id: 'cancer_outreach', name: 'Cancer Outreach', category: 'service', members: 28 },
  { id: 'sharewood', name: 'Sharewood Volunteers', category: 'service', members: 40 },
  { id: 'chinacare', name: 'Tufts ChinaCare', category: 'service', members: 18 },
  { id: 'move_up', name: 'Move Up Global', category: 'service', members: 22 },
  { id: 'medlife', name: 'MEDLIFE', category: 'service', members: 45 },
  { id: 'pollinator', name: 'Tufts Pollinator Initiative', category: 'service', members: 15 },
  { id: 'student_garden', name: 'Student Garden', category: 'service', members: 25 },
  { id: 'slow_food', name: 'Slow Food Tufts', category: 'service', members: 20 },
  { id: 'eco_ambassadors', name: 'Student Eco-Ambassadors', category: 'service', members: 30 },
  { id: 'see', name: 'Students for Educational Equality', category: 'service', members: 35 },

  // Pre-Professional & Academic
  { id: '180dc', name: '180 Degrees Consulting', category: 'academic', members: 40 },
  { id: 'prelaw', name: 'Pre-Law Society', category: 'academic', members: 65 },
  { id: 'premed', name: 'Tufts Pre-Medical Society', category: 'academic', members: 120 },
  { id: 'mock_trial', name: 'Tufts Mock Trial', category: 'academic', members: 30 },
  { id: 'model_un', name: 'Tufts Model United Nations', category: 'academic', members: 45 },
  { id: 'debate', name: 'Tufts Debate Society', category: 'academic', members: 35 },
  { id: 'maps', name: 'Minority Assoc. of Pre-Health Students (MAPS)', category: 'academic', members: 50 },
  { id: 'tpu', name: 'Tufts Political Union', category: 'academic', members: 55 },
  { id: 'psych', name: 'Tufts Psychology Society', category: 'academic', members: 42 },
  { id: 'history_soc', name: 'Tufts History Society', category: 'academic', members: 25 },
  { id: 'neuro', name: 'Tufts Neuroscience Network', category: 'academic', members: 38 },
  { id: 'scioly', name: 'JumboScioly (Science Olympiad)', category: 'academic', members: 28 },
  { id: 'quiz_bowl', name: 'Tufts Quiz Bowl', category: 'academic', members: 20 },
  { id: 'tedx', name: 'TEDxTufts', category: 'academic', members: 40 },
  { id: 'geography', name: 'Geography Club', category: 'academic', members: 18 },
  { id: 'prevet', name: 'Pre-Vet Society', category: 'academic', members: 30 },
  { id: 'cog_sci', name: 'Cognitive Science Reading Group', category: 'academic', members: 15 },
  { id: 'econ_soc', name: 'Economics Society', category: 'academic', members: 55 },
  { id: 'wip', name: 'Tufts Women in Product', category: 'academic', members: 35 },
  { id: 'ascend', name: 'Tufts Ascend (Business)', category: 'academic', members: 45 },
  { id: 'diversity_fund', name: 'Diversity Trading Fund', category: 'academic', members: 22 },

  // Sports & Recreation
  { id: 'fencing', name: 'Club Fencing', category: 'sports', members: 25 },
  { id: 'swim', name: 'Club Swimming', category: 'sports', members: 30 },
  { id: 'badminton', name: 'Badminton Club', category: 'sports', members: 35 },
  { id: 'boxing', name: 'Tufts Boxing Club', category: 'sports', members: 28 },
  { id: 'judo', name: 'Tufts Judo', category: 'sports', members: 18 },
  { id: 'squash', name: 'Squash Club', category: 'sports', members: 22 },
  { id: 'table_tennis', name: 'Table Tennis Club', category: 'sports', members: 30 },
  { id: 'quadball', name: 'Tufflepuffs (Quadball)', category: 'sports', members: 25 },
  { id: 'gymnastics', name: 'Tufts Gymnastics', category: 'sports', members: 20 },
  { id: 'hockey', name: 'Tufts Hockey Club', category: 'sports', members: 28 },
  { id: 'cheer', name: 'Tufts Cheerleading', category: 'sports', members: 24 },
  { id: 'fitness', name: 'Tufts Fitness Club', category: 'sports', members: 45 },
  { id: 'pickleball', name: 'Club Pickleball', category: 'sports', members: 32 },
  { id: 'f1', name: 'F1 Club', category: 'sports', members: 20 },
  { id: 'fire_flow', name: 'Jumbo Fire & Flow', category: 'sports', members: 15 },
  { id: 'jugglers', name: 'Jumbo Jugglers', category: 'sports', members: 12 },
  { id: 'chess', name: 'Jumbos Chess Club', category: 'sports', members: 25 },
  { id: 'cube', name: 'Cube Club', category: 'sports', members: 15 },
  { id: 'tabletop', name: 'Tabletop Gaming Club', category: 'sports', members: 30 },
  { id: 'gaming', name: 'Tufts Gaming Hub', category: 'sports', members: 55 },
  { id: 'bikes', name: 'Tufts Bikes', category: 'sports', members: 20 },
  { id: 'climbing', name: 'Climbing Club', category: 'sports', members: 35 },
  { id: 'soccer_club', name: 'Graduate Soccer Club', category: 'sports', members: 22 },
  { id: 'frisbee', name: 'Ultimate Frisbee Club', category: 'sports', members: 40 },

  // Religious & Spiritual
  { id: 'msa', name: 'Muslim Student Association', category: 'religious', members: 65 },
  { id: 'chabad', name: 'Chabad House', category: 'religious', members: 40 },
  { id: 'hillel', name: 'Granoff Family Hillel Center', category: 'religious', members: 120 },
  { id: 'abf', name: 'Asian Baptist Fellowship', category: 'religious', members: 25 },
  { id: 'buddhist', name: 'Mindfulness Buddhist Sangha', category: 'religious', members: 20 },
  { id: 'cvf', name: 'Christian Varsity Fellowship', category: 'religious', members: 35 },
  { id: 'ocf', name: 'Orthodox Christian Fellowship', category: 'religious', members: 18 },

  // Political & Advocacy
  { id: 'dems', name: 'Tufts Democrats', category: 'political', members: 60 },
  { id: 'pjs', name: 'Peace & Justice Society', category: 'political', members: 30 },
  { id: 'sda', name: 'Students Demand Action', category: 'political', members: 35 },
  { id: 'allies', name: 'ALLIES (Education & Services)', category: 'political', members: 28 },
  { id: 'civic', name: 'CIVIC (Cooperation & Innovation in Citizenship)', category: 'political', members: 25 },
  { id: 'goodman', name: 'Andrew Goodman Foundation / Vote Everywhere', category: 'political', members: 22 },
  { id: 'wiir', name: 'Women in International Relations (WIIR)', category: 'political', members: 30 },

  // Social & Programming
  { id: 'tusc', name: 'Tufts University Social Collective (TUSC)', category: 'social', members: 200 },
  { id: 'coffee_club', name: 'Tufts Coffee Club', category: 'social', members: 45 },
  { id: 'cheese', name: 'Tufts Cheese Club', category: 'social', members: 30 },
  { id: 'salon', name: 'Salon Soir\u00E9e', category: 'social', members: 20 },
  { id: 'design_thinking', name: 'Design Thinking Group', category: 'social', members: 25 },
  { id: 'junior_jumbos', name: 'Junior Jumbos', category: 'social', members: 15 },

  // Greek Life
  { id: 'alpha_psi', name: 'Alpha Psi', category: 'greek', members: 40 },
  { id: 'aepi', name: 'Alpha Epsilon Pi', category: 'greek', members: 45 },
  { id: 'sig_ep', name: 'Sigma Epsilon', category: 'greek', members: 38 },
  { id: 'dtu', name: 'Delta Tau Delta', category: 'greek', members: 42 },
  { id: 'zbt', name: 'Zeta Beta Tau', category: 'greek', members: 35 },
  { id: 'aoa', name: 'Alpha Omicron Alpha', category: 'greek', members: 30 },
  { id: 'chi_o', name: 'Chi Omega', category: 'greek', members: 48 },
  { id: 'aephi', name: 'Alpha Epsilon Phi', category: 'greek', members: 40 },
];

export default function ClubsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [joinedClubs, setJoinedClubs] = useState(new Set());
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [clubProfiles, setClubProfiles] = useState({}); // { clubId: { logoUri, bannerUri, color, description, website, instagram } }
  const [editingClub, setEditingClub] = useState(null); // club object being customized
  const [editForm, setEditForm] = useState({});
  const [clubRequests, setClubRequests] = useState({});
  const [requestModalClub, setRequestModalClub] = useState(null);
  const [requestMessage, setRequestMessage] = useState('');
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  // Load persisted data
  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(JOINED_CLUBS_KEY),
      AsyncStorage.getItem(CLUB_PROFILES_KEY),
      AsyncStorage.getItem(CLUB_REQUESTS_KEY),
    ]).then(([joinedData, profilesData, requestsData]) => {
      if (joinedData) setJoinedClubs(new Set(JSON.parse(joinedData)));
      if (profilesData) setClubProfiles(JSON.parse(profilesData));
      if (requestsData) setClubRequests(JSON.parse(requestsData));
    }).catch(() => {});
  }, []);

  const saveJoined = useCallback((updated) => {
    AsyncStorage.setItem(JOINED_CLUBS_KEY, JSON.stringify([...updated])).catch(() => {});
  }, []);

  const saveProfiles = useCallback((profiles) => {
    AsyncStorage.setItem(CLUB_PROFILES_KEY, JSON.stringify(profiles)).catch(() => {});
  }, []);

  const saveRequests = useCallback((requests) => {
    AsyncStorage.setItem(CLUB_REQUESTS_KEY, JSON.stringify(requests)).catch(() => {});
  }, []);

  const handleJoinPress = useCallback((club) => {
    const isJoined = joinedClubs.has(club.id);
    const pendingRequest = (clubRequests[club.id] || []).find(
      (r) => r.isCurrentUser && r.status === 'pending'
    );

    if (isJoined) {
      setJoinedClubs((prev) => {
        const next = new Set(prev);
        next.delete(club.id);
        saveJoined(next);
        return next;
      });
    } else if (pendingRequest) {
      Alert.alert('Request Pending', 'Your request to join this club is being reviewed.');
    } else {
      setRequestModalClub(club);
      setRequestMessage('');
    }
  }, [joinedClubs, clubRequests, saveJoined]);

  const submitRequest = useCallback(() => {
    if (!requestModalClub || !requestMessage.trim()) return;

    const newRequest = {
      id: Date.now().toString(),
      name: 'You',
      message: requestMessage.trim(),
      status: 'pending',
      timestamp: new Date().toISOString(),
      isCurrentUser: true,
    };

    setClubRequests((prev) => {
      const updated = {
        ...prev,
        [requestModalClub.id]: [...(prev[requestModalClub.id] || []), newRequest],
      };
      saveRequests(updated);
      return updated;
    });
    setRequestModalClub(null);
    setRequestMessage('');
  }, [requestModalClub, requestMessage, saveRequests]);

  const admitRequest = useCallback((clubId, requestId) => {
    const club = ALL_CLUBS.find((c) => c.id === clubId);
    setClubRequests((prev) => {
      const requests = (prev[clubId] || []).map((r) =>
        r.id === requestId ? { ...r, status: 'admitted' } : r
      );
      const updated = { ...prev, [clubId]: requests };
      saveRequests(updated);

      const admittedReq = requests.find((r) => r.id === requestId);
      if (admittedReq?.isCurrentUser) {
        setJoinedClubs((prevJoined) => {
          const next = new Set(prevJoined);
          next.add(clubId);
          saveJoined(next);
          return next;
        });
      }

      Alert.alert(
        'Member Admitted!',
        `${admittedReq?.name || 'User'} has been admitted to ${club?.name || 'the club'}.`
      );
      return updated;
    });
  }, [saveRequests, saveJoined]);

  const declineRequest = useCallback((clubId, requestId) => {
    setClubRequests((prev) => {
      const requests = (prev[clubId] || []).filter((r) => r.id !== requestId);
      const updated = { ...prev, [clubId]: requests };
      saveRequests(updated);
      return updated;
    });
  }, [saveRequests]);

  // Open customization modal & seed mock requests if none exist
  const openCustomize = useCallback((club) => {
    const existing = clubProfiles[club.id] || {};
    setEditForm({
      description: existing.description || '',
      color: existing.color || '#163D6B',
      logoUri: existing.logoUri || null,
      bannerUri: existing.bannerUri || null,
      website: existing.website || '',
      instagram: existing.instagram || '',
    });

    // Seed mock pending requests for demo if club has no non-user requests
    if (!(clubRequests[club.id] || []).some((r) => !r.isCurrentUser)) {
      const mockReqs = MOCK_REQUESTERS.map((m, i) => ({
        id: `mock_${club.id}_${i}`,
        name: m.name,
        message: m.message,
        status: 'pending',
        timestamp: new Date(Date.now() - (i + 1) * 3600000).toISOString(),
        isCurrentUser: false,
      }));
      setClubRequests((prev) => {
        const existingReqs = prev[club.id] || [];
        const updated = { ...prev, [club.id]: [...existingReqs, ...mockReqs] };
        saveRequests(updated);
        return updated;
      });
    }

    setEditingClub(club);
  }, [clubProfiles, clubRequests, saveRequests]);

  const closeCustomize = useCallback(() => {
    setEditingClub(null);
    setEditForm({});
  }, []);

  const pickLogo = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to set a club logo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]) {
      setEditForm((prev) => ({ ...prev, logoUri: result.assets[0].uri }));
    }
  }, []);

  const pickBanner = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to set a banner.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]) {
      setEditForm((prev) => ({ ...prev, bannerUri: result.assets[0].uri }));
    }
  }, []);

  const saveCustomization = useCallback(() => {
    if (!editingClub) return;
    const updated = {
      ...clubProfiles,
      [editingClub.id]: { ...editForm },
    };
    setClubProfiles(updated);
    saveProfiles(updated);
    setEditingClub(null);
    setEditForm({});
  }, [editingClub, editForm, clubProfiles, saveProfiles]);

  const filteredClubs = useMemo(() => {
    let clubs = ALL_CLUBS;
    if (selectedCategory !== 'all') {
      clubs = clubs.filter((c) => c.category === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      clubs = clubs.filter((c) => c.name.toLowerCase().includes(q));
    }
    return clubs;
  }, [selectedCategory, searchQuery]);

  const groupedClubs = useMemo(() => {
    if (selectedCategory !== 'all') return null;
    const groups = {};
    filteredClubs.forEach((club) => {
      if (!groups[club.category]) groups[club.category] = [];
      groups[club.category].push(club);
    });
    return groups;
  }, [filteredClubs, selectedCategory]);

  const joinedCount = joinedClubs.size;

  const renderClubItem = useCallback((club) => {
    const isJoined = joinedClubs.has(club.id);
    const catInfo = CLUB_CATEGORIES.find((c) => c.id === club.category);
    const profile = clubProfiles[club.id];
    const hasCustomLogo = profile?.logoUri;
    const brandColor = profile?.color || null;

    return (
      <View key={club.id} style={styles.clubCard}>
        {/* Club logo / emoji */}
        <TouchableOpacity
          style={[styles.clubEmoji, brandColor && { backgroundColor: brandColor + '18' }]}
          onPress={isJoined ? () => openCustomize(club) : undefined}
          activeOpacity={isJoined ? 0.7 : 1}
          disabled={!isJoined}
        >
          <Image
            source={{ uri: hasCustomLogo ? profile.logoUri : `https://api.dicebear.com/9.x/shapes/png?seed=${club.id}&size=80` }}
            style={styles.clubLogoImg}
          />
        </TouchableOpacity>

        {/* Club info */}
        <TouchableOpacity
          style={styles.clubInfo}
          onPress={isJoined ? () => openCustomize(club) : undefined}
          activeOpacity={isJoined ? 0.7 : 1}
          disabled={!isJoined}
        >
          <Text style={styles.clubName} numberOfLines={2}>{club.name}</Text>
          <View style={styles.clubMeta}>
            <Users size={10} color={colors.textTertiary} />
            <Text style={styles.clubMembers}>{club.members} members</Text>
            {isJoined && (
              <>
                <Text style={styles.clubDot}>{'\u00B7'}</Text>
                <Settings size={10} color={colors.accent} />
                <Text style={styles.clubCustomize}>Customize</Text>
              </>
            )}
          </View>
        </TouchableOpacity>

        {/* Join / Pending / Joined button */}
        {(() => {
          const isPending = (clubRequests[club.id] || []).some(
            (r) => r.isCurrentUser && r.status === 'pending'
          );
          if (isJoined) {
            return (
              <TouchableOpacity
                style={[styles.joinBtn, styles.joinedBtn]}
                onPress={() => handleJoinPress(club)}
                activeOpacity={0.7}
              >
                <Check size={13} color="#22C55E" />
                <Text style={styles.joinedBtnText}>Joined</Text>
              </TouchableOpacity>
            );
          }
          if (isPending) {
            return (
              <TouchableOpacity
                style={[styles.joinBtn, styles.pendingBtn]}
                onPress={() => handleJoinPress(club)}
                activeOpacity={0.7}
              >
                <Clock size={13} color="#F59E0B" />
                <Text style={styles.pendingBtnText}>Pending</Text>
              </TouchableOpacity>
            );
          }
          return (
            <TouchableOpacity
              style={styles.joinBtn}
              onPress={() => handleJoinPress(club)}
              activeOpacity={0.7}
            >
              <Text style={styles.joinBtnText}>Join</Text>
            </TouchableOpacity>
          );
        })()}
      </View>
    );
  }, [joinedClubs, clubRequests, colors, styles, handleJoinPress, clubProfiles, openCustomize]);

  const renderCategoryGroup = useCallback(({ item: catId }) => {
    if (!groupedClubs || !groupedClubs[catId]) return null;
    const clubs = groupedClubs[catId];
    const catInfo = CLUB_CATEGORIES.find((c) => c.id === catId);
    const isExpanded = expandedCategory === catId;
    const displayClubs = isExpanded ? clubs : clubs.slice(0, 3);

    return (
      <View style={styles.categoryGroup}>
        <TouchableOpacity
          style={styles.categoryGroupHeader}
          onPress={() => setExpandedCategory(isExpanded ? null : catId)}
          activeOpacity={0.7}
        >
          <Text style={styles.categoryGroupEmoji}>{catInfo?.emoji}</Text>
          <Text style={styles.categoryGroupTitle}>{catInfo?.label}</Text>
          <Text style={styles.categoryGroupCount}>{clubs.length}</Text>
          {isExpanded ? (
            <ChevronUp size={16} color={colors.textTertiary} />
          ) : (
            <ChevronDown size={16} color={colors.textTertiary} />
          )}
        </TouchableOpacity>
        {displayClubs.map(renderClubItem)}
        {!isExpanded && clubs.length > 3 && (
          <TouchableOpacity style={styles.showMoreBtn} onPress={() => setExpandedCategory(catId)}>
            <Text style={styles.showMoreText}>Show {clubs.length - 3} more</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }, [groupedClubs, expandedCategory, colors, styles, renderClubItem]);

  const renderFilteredClub = useCallback(({ item: club }) => renderClubItem(club), [renderClubItem]);

  const categoryIds = useMemo(() => {
    if (!groupedClubs) return [];
    return CLUB_CATEGORIES.filter((c) => c.id !== 'all' && groupedClubs[c.id]).map((c) => c.id);
  }, [groupedClubs]);

  return (
    <LinearGradient colors={colors.backgroundGradient} style={styles.container}>
      <StatusBar barStyle={colors.statusBarStyle} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerEmoji}>{'\u{1F3AF}'}</Text>
          <Text style={styles.headerTitle}>Join Clubs</Text>
        </View>
        <TouchableOpacity
          style={styles.browseBtn}
          onPress={() => Linking.openURL('https://students.tufts.edu/student-organizations')}
        >
          <ExternalLink size={18} color={colors.accent} />
        </TouchableOpacity>
      </View>

      {/* Joined count banner */}
      {joinedCount > 0 && (
        <View style={styles.joinedBanner}>
          <Check size={14} color="#22C55E" />
          <Text style={styles.joinedBannerText}>
            You've joined {joinedCount} club{joinedCount !== 1 ? 's' : ''} {'\u00B7'} Tap a club to customize
          </Text>
        </View>
      )}

      {/* Search */}
      <Animated.View style={[styles.searchWrap, { opacity: fadeAnim }]}>
        <Search size={16} color={colors.textTertiary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search 200+ clubs..."
          placeholderTextColor={colors.placeholder}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <X size={16} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </Animated.View>

      {/* Category chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryChips}>
        {CLUB_CATEGORIES.map((cat) => {
          const isActive = selectedCategory === cat.id;
          return (
            <TouchableOpacity
              key={cat.id}
              style={[styles.catChip, isActive && styles.catChipActive]}
              onPress={() => setSelectedCategory(cat.id)}
            >
              <Text style={styles.catChipEmoji}>{cat.emoji}</Text>
              <Text style={[styles.catChipText, isActive && styles.catChipTextActive]}>{cat.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Club list */}
      {selectedCategory === 'all' && !searchQuery.trim() ? (
        <FlatList
          data={categoryIds}
          keyExtractor={(item) => item}
          renderItem={renderCategoryGroup}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 90 }]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>{'\u{1F50D}'}</Text>
              <Text style={styles.emptyTitle}>No clubs found</Text>
              <Text style={styles.emptySubtext}>Try a different search term</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={filteredClubs}
          keyExtractor={(item) => item.id}
          renderItem={renderFilteredClub}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 90 }]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>{'\u{1F50D}'}</Text>
              <Text style={styles.emptyTitle}>No clubs found</Text>
              <Text style={styles.emptySubtext}>Try a different search or category</Text>
            </View>
          }
        />
      )}

      {/* ── Join Request Modal ── */}
      <Modal visible={!!requestModalClub} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={[styles.requestModalContent, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Request to Join</Text>
                <Text style={styles.modalSubtitle}>{requestModalClub?.name}</Text>
              </View>
              <TouchableOpacity onPress={() => { setRequestModalClub(null); setRequestMessage(''); }}>
                <X size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Why are you interested?</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline, { minHeight: 100 }]}
              placeholder="Tell the club why you'd like to join..."
              placeholderTextColor={colors.placeholder}
              value={requestMessage}
              onChangeText={setRequestMessage}
              multiline
              maxLength={300}
              autoFocus
            />
            <Text style={styles.charCount}>{requestMessage.length}/300</Text>

            <TouchableOpacity
              style={[styles.submitRequestBtn, !requestMessage.trim() && styles.submitRequestBtnDisabled]}
              onPress={submitRequest}
              activeOpacity={0.85}
              disabled={!requestMessage.trim()}
            >
              <UserPlus size={18} color="#FFF" />
              <Text style={styles.submitRequestBtnText}>Send Request</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Club Customization Modal ── */}
      <Modal visible={!!editingClub} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <View style={styles.modalHandle} />

            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Customize Club</Text>
                <Text style={styles.modalSubtitle}>{editingClub?.name}</Text>
              </View>
              <TouchableOpacity onPress={closeCustomize}>
                <X size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Pending Requests Section */}
              {editingClub && (clubRequests[editingClub.id] || []).filter((r) => r.status === 'pending' && !r.isCurrentUser).length > 0 && (
                <View style={styles.requestsSection}>
                  <View style={styles.requestsSectionHeader}>
                    <UserPlus size={16} color="#F59E0B" />
                    <Text style={styles.requestsSectionTitle}>
                      Join Requests ({(clubRequests[editingClub.id] || []).filter((r) => r.status === 'pending' && !r.isCurrentUser).length})
                    </Text>
                  </View>
                  {(clubRequests[editingClub.id] || [])
                    .filter((r) => r.status === 'pending' && !r.isCurrentUser)
                    .map((req) => (
                      <View key={req.id} style={styles.requestCard}>
                        <View style={styles.requestAvatar}>
                          <Text style={styles.requestAvatarText}>{req.name.charAt(0)}</Text>
                        </View>
                        <View style={styles.requestInfo}>
                          <Text style={styles.requestName}>{req.name}</Text>
                          <Text style={styles.requestMessage} numberOfLines={2}>{req.message}</Text>
                          <Text style={styles.requestTime}>
                            {new Date(req.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                          </Text>
                        </View>
                        <View style={styles.requestActions}>
                          <TouchableOpacity
                            style={styles.admitBtn}
                            onPress={() => admitRequest(editingClub.id, req.id)}
                          >
                            <Check size={16} color="#FFF" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.declineBtn}
                            onPress={() => declineRequest(editingClub.id, req.id)}
                          >
                            <X size={16} color="#FFF" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                </View>
              )}

              {/* Banner Preview */}
              <Text style={styles.fieldLabel}>Club Banner</Text>
              <TouchableOpacity style={styles.bannerUpload} onPress={pickBanner} activeOpacity={0.8}>
                {editForm.bannerUri ? (
                  <Image source={{ uri: editForm.bannerUri }} style={styles.bannerPreview} resizeMode="cover" />
                ) : (
                  <View style={styles.bannerPlaceholder}>
                    <ImageIcon size={24} color={colors.textMuted} />
                    <Text style={styles.bannerPlaceholderText}>Tap to upload banner (16:9)</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Logo */}
              <Text style={styles.fieldLabel}>Club Logo</Text>
              <View style={styles.logoRow}>
                <TouchableOpacity style={styles.logoUpload} onPress={pickLogo} activeOpacity={0.8}>
                  {editForm.logoUri ? (
                    <Image source={{ uri: editForm.logoUri }} style={styles.logoPreview} resizeMode="cover" />
                  ) : (
                    <View style={styles.logoPlaceholder}>
                      <Camera size={20} color={colors.textMuted} />
                    </View>
                  )}
                </TouchableOpacity>
                <View style={styles.logoHint}>
                  <Text style={styles.logoHintTitle}>Upload your logo</Text>
                  <Text style={styles.logoHintText}>Square image recommended (1:1)</Text>
                  {editForm.logoUri && (
                    <TouchableOpacity onPress={() => setEditForm((p) => ({ ...p, logoUri: null }))}>
                      <Text style={styles.removeText}>Remove logo</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Brand Color */}
              <Text style={styles.fieldLabel}>Brand Color</Text>
              <View style={styles.colorGrid}>
                {BRAND_COLORS.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.colorSwatch, { backgroundColor: c }, editForm.color === c && styles.colorSwatchActive]}
                    onPress={() => setEditForm((p) => ({ ...p, color: c }))}
                    activeOpacity={0.7}
                  >
                    {editForm.color === c && <Check size={14} color="#FFF" />}
                  </TouchableOpacity>
                ))}
              </View>

              {/* Description */}
              <Text style={styles.fieldLabel}>Description</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                placeholder="Tell students what your club is about..."
                placeholderTextColor={colors.placeholder}
                value={editForm.description}
                onChangeText={(t) => setEditForm((p) => ({ ...p, description: t }))}
                multiline
                maxLength={500}
              />

              {/* Website */}
              <Text style={styles.fieldLabel}>Website</Text>
              <View style={styles.inputWithIcon}>
                <Globe size={16} color={colors.textTertiary} />
                <TextInput
                  style={styles.iconInput}
                  placeholder="https://your-club-site.com"
                  placeholderTextColor={colors.placeholder}
                  value={editForm.website}
                  onChangeText={(t) => setEditForm((p) => ({ ...p, website: t }))}
                  autoCapitalize="none"
                  keyboardType="url"
                  maxLength={200}
                />
              </View>

              {/* Instagram */}
              <Text style={styles.fieldLabel}>Instagram</Text>
              <View style={styles.inputWithIcon}>
                <Instagram size={16} color={colors.textTertiary} />
                <TextInput
                  style={styles.iconInput}
                  placeholder="@your_club_handle"
                  placeholderTextColor={colors.placeholder}
                  value={editForm.instagram}
                  onChangeText={(t) => setEditForm((p) => ({ ...p, instagram: t }))}
                  autoCapitalize="none"
                  maxLength={100}
                />
              </View>

              {/* Save */}
              <TouchableOpacity style={styles.saveBtn} onPress={saveCustomization} activeOpacity={0.85}>
                <Check size={18} color="#FFF" />
                <Text style={styles.saveBtnText}>Save Customization</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <BottomNav navigation={navigation} activeTab="" />
    </LinearGradient>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: colors.headerBg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.cardBorder,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 14, backgroundColor: colors.inputBg,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.cardBorder,
  },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  headerEmoji: { fontSize: 22 },
  headerTitle: { fontSize: 20, fontWeight: '900', color: colors.text },
  browseBtn: {
    width: 44, height: 44, borderRadius: 14, backgroundColor: colors.inputBg,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.cardBorder,
  },

  joinedBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 8, backgroundColor: 'rgba(34,197,94,0.08)',
  },
  joinedBannerText: { fontSize: 12, fontWeight: '700', color: '#22C55E' },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginTop: 12, marginBottom: 10,
    paddingHorizontal: 14, paddingVertical: 11, borderRadius: 14, backgroundColor: colors.inputBg,
    borderWidth: 1, borderColor: colors.inputBorder,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.text, padding: 0 },

  categoryChips: { paddingHorizontal: 16, gap: 8, paddingBottom: 12 },
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder,
  },
  catChipActive: { backgroundColor: colors.buttonPrimary, borderColor: colors.buttonPrimary },
  catChipEmoji: { fontSize: 13 },
  catChipText: { fontSize: 12, fontWeight: '700', color: colors.textTertiary },
  catChipTextActive: { color: '#FFF' },

  listContent: { paddingHorizontal: 16, paddingTop: 4 },

  categoryGroup: { marginBottom: 16 },
  categoryGroupHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 4 },
  categoryGroupEmoji: { fontSize: 18 },
  categoryGroupTitle: { flex: 1, fontSize: 16, fontWeight: '800', color: colors.text },
  categoryGroupCount: {
    fontSize: 12, fontWeight: '700', color: colors.textTertiary, backgroundColor: colors.inputBg,
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, overflow: 'hidden',
  },

  // Club card
  clubCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12,
    marginBottom: 6, borderRadius: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder,
  },
  clubEmoji: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.inputBg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  clubEmojiText: { fontSize: 18 },
  clubLogoImg: { width: 40, height: 40, borderRadius: 12 },
  clubInfo: { flex: 1 },
  clubName: { fontSize: 14, fontWeight: '700', color: colors.text, lineHeight: 18 },
  clubMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  clubMembers: { fontSize: 11, fontWeight: '500', color: colors.textTertiary },
  clubDot: { fontSize: 10, color: colors.textMuted },
  clubCustomize: { fontSize: 11, fontWeight: '600', color: colors.accent },

  joinBtn: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.buttonPrimary,
    minWidth: 64, alignItems: 'center', justifyContent: 'center',
  },
  joinBtnText: { fontSize: 13, fontWeight: '800', color: '#FFF' },
  joinedBtn: { backgroundColor: 'rgba(34,197,94,0.12)', flexDirection: 'row', gap: 4 },
  joinedBtnText: { fontSize: 13, fontWeight: '700', color: '#22C55E' },

  showMoreBtn: { alignItems: 'center', paddingVertical: 10 },
  showMoreText: { fontSize: 13, fontWeight: '700', color: colors.accent },

  emptyState: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyEmoji: { fontSize: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  emptySubtext: { fontSize: 13, color: colors.textMuted },

  // ── Customization Modal ──
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  modalContent: {
    backgroundColor: colors.headerBg, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 10, maxHeight: '92%',
  },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.textMuted, alignSelf: 'center', marginBottom: 14 },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18, gap: 12 },
  modalTitle: { fontSize: 20, fontWeight: '900', color: colors.text },
  modalSubtitle: { fontSize: 13, fontWeight: '600', color: colors.textTertiary, marginTop: 2 },

  fieldLabel: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginBottom: 8, marginTop: 18 },

  // Banner
  bannerUpload: { borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: colors.cardBorder, borderStyle: 'dashed' },
  bannerPreview: { width: '100%', height: 120, borderRadius: 14 },
  bannerPlaceholder: {
    width: '100%', height: 120, alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: colors.inputBg, borderRadius: 14,
  },
  bannerPlaceholderText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },

  // Logo
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  logoUpload: { width: 72, height: 72, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: colors.cardBorder, borderStyle: 'dashed' },
  logoPreview: { width: 72, height: 72, borderRadius: 18 },
  logoPlaceholder: {
    width: 72, height: 72, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.inputBg,
  },
  logoHint: { flex: 1, gap: 3 },
  logoHintTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  logoHintText: { fontSize: 12, color: colors.textTertiary },
  removeText: { fontSize: 12, fontWeight: '700', color: colors.error, marginTop: 4 },

  // Color picker
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorSwatch: {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
  },
  colorSwatchActive: {
    borderWidth: 3, borderColor: '#FFF',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4,
  },

  // Inputs
  input: {
    backgroundColor: colors.inputBg, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: colors.text, borderWidth: 1, borderColor: colors.inputBorder,
  },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
  inputWithIcon: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.inputBg,
    borderRadius: 14, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.inputBorder,
  },
  iconInput: { flex: 1, fontSize: 15, color: colors.text, paddingVertical: 14 },

  // Save
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 16, borderRadius: 16, backgroundColor: '#22C55E', marginTop: 24, marginBottom: 12,
  },
  saveBtnText: { fontSize: 16, fontWeight: '800', color: '#FFF' },

  // Pending button
  pendingBtn: { backgroundColor: 'rgba(245,158,11,0.12)', flexDirection: 'row', gap: 4 },
  pendingBtnText: { fontSize: 13, fontWeight: '700', color: '#F59E0B' },

  // Request modal
  requestModalContent: {
    backgroundColor: colors.headerBg, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 10,
  },
  charCount: { fontSize: 11, color: colors.textTertiary, textAlign: 'right', marginTop: 4 },
  submitRequestBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 16, borderRadius: 16, backgroundColor: colors.buttonPrimary, marginTop: 20, marginBottom: 12,
  },
  submitRequestBtnDisabled: { opacity: 0.4 },
  submitRequestBtnText: { fontSize: 16, fontWeight: '800', color: '#FFF' },

  // Requests section in customize modal
  requestsSection: {
    backgroundColor: 'rgba(245,158,11,0.06)', borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: 'rgba(245,158,11,0.2)', marginBottom: 8,
  },
  requestsSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  requestsSectionTitle: { fontSize: 15, fontWeight: '800', color: '#F59E0B' },
  requestCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(245,158,11,0.15)',
  },
  requestAvatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(245,158,11,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  requestAvatarText: { fontSize: 14, fontWeight: '800', color: '#F59E0B' },
  requestInfo: { flex: 1, gap: 2 },
  requestName: { fontSize: 13, fontWeight: '700', color: colors.text },
  requestMessage: { fontSize: 12, color: colors.textTertiary, lineHeight: 16 },
  requestTime: { fontSize: 10, color: colors.textMuted, marginTop: 2 },
  requestActions: { flexDirection: 'row', gap: 6 },
  admitBtn: {
    width: 32, height: 32, borderRadius: 10, backgroundColor: '#22C55E',
    alignItems: 'center', justifyContent: 'center',
  },
  declineBtn: {
    width: 32, height: 32, borderRadius: 10, backgroundColor: '#EF4444',
    alignItems: 'center', justifyContent: 'center',
  },
});
