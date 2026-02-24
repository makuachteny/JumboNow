import React, { createContext, useContext, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService } from '../services/auth.service';
import { eventsService } from '../services/events.service';
import { ticketsService } from '../services/tickets.service';

const DAY = 86400000;
const HOUR = 3600000;

const DEMO_PROFILES = {
  student: {
    id: 'demo-student-001',
    username: 'alex_chen',
    display_name: 'Alex Chen',
    email: 'alex.chen@tufts.edu',
    account_type: 'student',
    graduation_year: '2027',
    major: 'Computer Science',
    campus: 'Medford/Somerville',
    bio: 'CS major exploring campus life at Tufts. Love hackathons, robotics, and late-night pizza runs.',
    avatar_color: '#418FDE',
    avatar_url: null,
    is_verified: true,
    joined_date: 'Sep 2023',
    events_attended: 12,
    tickets_count: 5,
    vibe_score: 72,
  },
  club: {
    id: 'demo-club-001',
    username: 'tufts_robotics',
    display_name: 'Tufts Robotics Club',
    email: 'robotics@tufts.edu',
    account_type: 'club',
    graduation_year: '',
    major: '',
    campus: 'Medford/Somerville',
    bio: 'Building the future, one robot at a time. Meetings every Wednesday 7PM in Halligan Hall. All skill levels welcome!',
    avatar_color: '#8B5CF6',
    avatar_url: null,
    is_verified: true,
    joined_date: 'Jan 2022',
    events_attended: 0,
    tickets_count: 0,
    vibe_score: 88,
  },
  staff: {
    id: 'demo-staff-001',
    username: 'dr_martinez',
    display_name: 'Dr. Sarah Martinez',
    email: 'sarah.martinez@tufts.edu',
    account_type: 'staff',
    graduation_year: '',
    major: 'Computer Science Department',
    campus: 'Medford/Somerville',
    bio: 'Professor of Computer Science. Director of the Innovation Lab. Office hours: MWF 2-4PM, Halligan 230.',
    avatar_color: '#3579C6',
    avatar_url: null,
    is_verified: true,
    joined_date: 'Aug 2019',
    events_attended: 8,
    tickets_count: 3,
    vibe_score: 65,
  },
};

function buildDemoEvents() {
  const now = Date.now();
  return [
    {
      id: 'demo-ev-1',
      title: 'Spring Fling 2026',
      subtitle: "Tufts' biggest outdoor celebration",
      icon: '\uD83C\uDFAA',
      color: '#EC4899',
      gradient_colors: ['#EC4899', '#F43F5E', '#DC2626'],
      category: 'student_org',
      event_type: 'student_org',
      location: "President's Lawn",
      start_time: new Date(now + 3 * DAY).toISOString(),
      end_time: new Date(now + 3 * DAY + 4 * HOUR).toISOString(),
      max_capacity: 500,
      attendee_count: 342,
      tags: ['music', 'food', 'outdoor'],
      ticket_price: 0,
      is_free: true,
      organizer_name: 'Tufts Programming Board',
      image_url: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=600&q=80',
      is_featured: true,
      visibility: 'public',
      created_by: 'demo-club-001',
    },
    {
      id: 'demo-ev-2',
      title: 'CS Research Symposium',
      subtitle: 'Student research presentations',
      icon: '\uD83D\uDCA1',
      color: '#6366F1',
      gradient_colors: ['#6366F1', '#4F46E5', '#4338CA'],
      category: 'academic',
      event_type: 'academic',
      location: 'Halligan Hall 102',
      start_time: new Date(now + 1 * DAY + 10 * HOUR).toISOString(),
      end_time: new Date(now + 1 * DAY + 13 * HOUR).toISOString(),
      max_capacity: 120,
      attendee_count: 87,
      tags: ['cs', 'research', 'presentations'],
      ticket_price: 0,
      is_free: true,
      organizer_name: 'CS Department',
      image_url: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=600&q=80',
      is_featured: true,
      visibility: 'public',
      created_by: 'demo-staff-001',
    },
    {
      id: 'demo-ev-3',
      title: 'Jumbo Basketball vs. Bowdoin',
      subtitle: 'NESCAC Conference Game',
      icon: '\uD83C\uDFC0',
      color: '#EF4444',
      gradient_colors: ['#EF4444', '#DC2626', '#B91C1C'],
      category: 'sports',
      event_type: 'sports',
      location: 'Cousens Gymnasium',
      start_time: new Date(now + 2 * DAY + 19 * HOUR).toISOString(),
      end_time: new Date(now + 2 * DAY + 21 * HOUR).toISOString(),
      max_capacity: 1200,
      attendee_count: 845,
      tags: ['basketball', 'nescac', 'athletics'],
      ticket_price: 5,
      is_free: false,
      organizer_name: 'Tufts Athletics',
      image_url: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=600&q=80',
      is_featured: false,
      visibility: 'public',
      created_by: 'demo-staff-001',
    },
    {
      id: 'demo-ev-4',
      title: 'A Cappella Showcase',
      subtitle: 'All groups performing live',
      icon: '\uD83C\uDFA4',
      color: '#A78BFA',
      gradient_colors: ['#A78BFA', '#8B5CF6', '#D946EF'],
      category: 'arts_culture',
      event_type: 'arts_culture',
      location: 'Goddard Chapel',
      start_time: new Date(now + 5 * DAY + 20 * HOUR).toISOString(),
      end_time: new Date(now + 5 * DAY + 22 * HOUR).toISOString(),
      max_capacity: 300,
      attendee_count: 156,
      tags: ['music', 'acapella', 'performance'],
      ticket_price: 0,
      is_free: true,
      organizer_name: 'Tufts Music',
      image_url: 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=600&q=80',
      is_featured: false,
      visibility: 'public',
      created_by: 'demo-club-001',
    },
    {
      id: 'demo-ev-5',
      title: 'Robotics Club Workshop',
      subtitle: 'Intro to Arduino & sensors',
      icon: '\uD83E\uDD16',
      color: '#8B5CF6',
      gradient_colors: ['#8B5CF6', '#7C3AED', '#6D28D9'],
      category: 'student_org',
      event_type: 'student_org',
      location: 'SEC 253',
      start_time: new Date(now + 1 * DAY + 19 * HOUR).toISOString(),
      end_time: new Date(now + 1 * DAY + 21 * HOUR).toISOString(),
      max_capacity: 40,
      attendee_count: 28,
      tags: ['robotics', 'workshop', 'arduino'],
      ticket_price: 0,
      is_free: true,
      organizer_name: 'Tufts Robotics Club',
      is_featured: false,
      visibility: 'public',
      created_by: 'demo-club-001',
    },
    {
      id: 'demo-ev-6',
      title: 'Study Abroad Info Session',
      subtitle: 'Fall 2027 programs',
      icon: '\u2708\uFE0F',
      color: '#3B82F6',
      gradient_colors: ['#3B82F6', '#2563EB', '#1D4ED8'],
      category: 'academic',
      event_type: 'academic',
      location: 'Dowling Hall 745',
      start_time: new Date(now + 4 * DAY + 15 * HOUR).toISOString(),
      end_time: new Date(now + 4 * DAY + 16.5 * HOUR).toISOString(),
      max_capacity: 80,
      attendee_count: 45,
      tags: ['study-abroad', 'global', 'info-session'],
      ticket_price: 0,
      is_free: true,
      organizer_name: 'Global Programs',
      is_featured: false,
      visibility: 'public',
      created_by: 'demo-staff-001',
    },
    {
      id: 'demo-ev-7',
      title: 'Outdoor Movie Night',
      subtitle: 'Showing: Everything Everywhere All at Once',
      icon: '\uD83C\uDFAC',
      color: '#F59E0B',
      gradient_colors: ['#F59E0B', '#D97706', '#B45309'],
      category: 'campus_center',
      event_type: 'campus_center',
      location: 'Library Roof Deck',
      start_time: new Date(now + 6 * DAY + 20.5 * HOUR).toISOString(),
      end_time: new Date(now + 6 * DAY + 23 * HOUR).toISOString(),
      max_capacity: 200,
      attendee_count: 132,
      tags: ['movie', 'outdoor', 'chill'],
      ticket_price: 0,
      is_free: true,
      organizer_name: 'TCU Senate',
      image_url: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=600&q=80',
      is_featured: false,
      visibility: 'public',
      created_by: 'demo-club-001',
    },
    {
      id: 'demo-ev-8',
      title: 'Career Fair: Tech & Engineering',
      subtitle: '50+ companies recruiting',
      icon: '\uD83D\uDCBC',
      color: '#059669',
      gradient_colors: ['#34D399', '#10B981', '#059669'],
      category: 'academic',
      event_type: 'academic',
      location: 'Gantcher Center',
      start_time: new Date(now + 7 * DAY + 10 * HOUR).toISOString(),
      end_time: new Date(now + 7 * DAY + 16 * HOUR).toISOString(),
      max_capacity: 500,
      attendee_count: 278,
      tags: ['career', 'tech', 'recruiting'],
      ticket_price: 0,
      is_free: true,
      organizer_name: 'Tufts Career Center',
      image_url: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=600&q=80',
      is_featured: true,
      visibility: 'public',
      created_by: 'demo-staff-001',
    },
  ];
}

const DemoContext = createContext(null);

export function DemoProvider({ children }) {
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [demoRole, setDemoRole] = useState(null);
  const [demoEvents] = useState(() => buildDemoEvents());

  const enterDemoMode = useCallback(async (role) => {
    const profile = DEMO_PROFILES[role];
    setDemoRole(role);
    setIsDemoMode(true);
    authService.setDemoMode(profile);
    eventsService.setDemoEvents(demoEvents);
    ticketsService.setDemoEvents(demoEvents);
    await AsyncStorage.setItem('jumbonow_demo_mode', 'true');
    await AsyncStorage.setItem('jumbonow_demo_role', role);
    await AsyncStorage.setItem('jumbonow_onboarding_done', 'true');
  }, [demoEvents]);

  const exitDemoMode = useCallback(async () => {
    setDemoRole(null);
    setIsDemoMode(false);
    authService.clearDemoMode();
    eventsService.clearDemoEvents();
    ticketsService.setDemoEvents([]);
    await AsyncStorage.removeItem('jumbonow_demo_mode');
    await AsyncStorage.removeItem('jumbonow_demo_role');
  }, []);

  const demoProfile = demoRole ? DEMO_PROFILES[demoRole] : null;

  return (
    <DemoContext.Provider value={{ isDemoMode, demoRole, demoProfile, demoEvents, enterDemoMode, exitDemoMode }}>
      {children}
    </DemoContext.Provider>
  );
}

export function useDemo() {
  const ctx = useContext(DemoContext);
  if (!ctx) return { isDemoMode: false, demoRole: null, demoProfile: null, demoEvents: [], enterDemoMode: () => {}, exitDemoMode: () => {} };
  return ctx;
}

export { DEMO_PROFILES };
