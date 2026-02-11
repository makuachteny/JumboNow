# JumboNow - Technical Documentation

**Version:** 1.0.0
**Platform:** iOS, Android (React Native / Expo)
**Backend:** Supabase (PostgreSQL, Auth, Storage, Realtime)
**Last Updated:** February 2026

---

## Table of Contents

1. [Overview](#1-overview)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Authentication](#4-authentication)
5. [Screens](#5-screens)
6. [Services](#6-services)
7. [Database Schema](#7-database-schema)
8. [Storage](#8-storage)
9. [Real-Time Subscriptions](#9-real-time-subscriptions)
10. [Theming](#10-theming)
11. [Navigation](#11-navigation)
12. [Environment Variables](#12-environment-variables)
13. [Scripts](#13-scripts)

---

## 1. Overview

JumboNow is a mobile event discovery and ticketing platform built for Tufts University students. Students can browse campus events, reserve free spots or purchase tickets, manage friendships, receive real-time notifications, and create their own events with poster images.

**Core capabilities:**
- Event browsing with search, filters, and featured events
- Free RSVP and paid ticket purchases with confirmation codes
- Event creation with image upload, ticket tiers, and tagging
- Friend system with requests, suggestions, and real-time updates
- Push-style notification system with categorized alerts
- User profiles with avatar upload, bio, and achievement badges
- Light and dark theme support
- Real-time data sync via Supabase Realtime (Postgres Changes)

---

## 2. Tech Stack

| Layer              | Technology                              | Version   |
| ------------------ | --------------------------------------- | --------- |
| Framework          | React Native                            | 0.81.5    |
| Toolchain          | Expo                                    | 54.0.33   |
| Runtime            | React                                   | 19.1.0    |
| Navigation         | React Navigation (Native Stack)         | 7.1.28    |
| Backend            | Supabase (PostgreSQL + Auth + Storage)  | 2.95.3    |
| Local Storage      | @react-native-async-storage             | 2.2.0     |
| Icons              | lucide-react-native                     | 0.563.0   |
| Image Picker       | expo-image-picker                       | 17.0.10   |
| Clipboard          | expo-clipboard                          | 7.0.2     |
| Safe Area          | react-native-safe-area-context          | 5.4.0     |

---

## 3. Project Structure

```
JumboNow/
├── App.js                          # Entry point, ErrorBoundary, navigation
├── app.json                        # Expo configuration
├── package.json                    # Dependencies and scripts
├── index.js                        # registerRootComponent
│
├── assets/
│   ├── jumbo-logo.png              # App logo (Tufts Jumbo)
│   ├── splash-icon.png             # Splash screen icon
│   ├── icon.png                    # App icon
│   └── adaptive-icon.png           # Android adaptive icon
│
├── scripts/
│   └── scrape-ocl.js               # OCL event data importer
│
├── src/
│   ├── config/
│   │   └── supabase.js             # Supabase client initialization
│   │
│   ├── context/
│   │   └── ThemeContext.js          # Light/dark theme provider
│   │
│   ├── utils/
│   │   └── safeColor.js            # Hex color validation utility
│   │
│   ├── components/
│   │   └── BottomNav.js            # Tab bar (Events, Discover, Tickets, Profile)
│   │
│   ├── services/
│   │   ├── auth.service.js         # Authentication and profile management
│   │   ├── events.service.js       # Event CRUD, filtering, attendance
│   │   ├── tickets.service.js      # Reservations and ticket purchases
│   │   ├── friends.service.js      # Friend requests, suggestions
│   │   ├── notifications.service.js# Notification management
│   │   └── storage.service.js      # Avatar image upload/delete
│   │
│   └── screens/
│       ├── LandingScreen.js        # Welcome screen (unauthenticated)
│       ├── LoginScreen.js          # Email/password login
│       ├── RegisterScreen.js       # Account creation (@tufts.edu)
│       ├── HomeScreen.js           # Main feed with featured events
│       ├── DiscoverScreen.js       # Search + advanced filters
│       ├── EventDetailScreen.js    # Full event view + ticketing
│       ├── CreateEventScreen.js    # Event creation form
│       ├── MyTicketsScreen.js      # User's reservations
│       ├── ProfileScreen.js        # User profile + settings
│       ├── FriendsScreen.js        # Friends, requests, suggestions
│       ├── NotificationsScreen.js  # Notification center
│       └── ChatScreen.js           # Messaging (coming soon)
│
└── supabase/
    └── migrations/
        ├── 00001_create_profiles.sql
        ├── 00002_create_events.sql
        ├── 00003_create_activities.sql
        ├── 00004_create_friendships.sql
        ├── 00005_create_notifications.sql
        ├── 00006_rls_policies.sql
        ├── 00007_database_functions.sql
        ├── 00008_triggers.sql
        ├── 00009_seed_data.sql
        ├── 00010_ocl_transform.sql
        ├── 00011_ocl_seed_data.sql
        ├── 00012_tufts_blue_colors.sql
        ├── 00013_fix_notification_insert_policy.sql
        ├── 00014_add_performance_indexes.sql
        └── 00015_create_event_images_bucket.sql
```

---

## 4. Authentication

**Provider:** Supabase Auth (email + password)

**Registration requirements:**
- Valid `@tufts.edu` email address
- Unique username
- Graduation year
- Minimum 8-character password

**Flow:**
1. User registers via `RegisterScreen` -> `authService.signUp()`
2. Supabase creates auth user -> trigger `handle_new_user()` fires
3. Trigger creates a `profiles` row and sends a welcome notification
4. Session token stored in AsyncStorage, auto-refreshed
5. `App.js` subscribes to `onAuthStateChange` and routes accordingly

**Route protection:**
- Unauthenticated users see: Landing, Login, Register
- Authenticated users see: All app screens
- Controlled via `AppNavigator` in `App.js`

**Profile management:**

- `authService.getCurrentProfile()` fetches the user's profile
- `authService.updateProfile(updates)` applies a field whitelist before writing:
  - Allowed fields: `display_name`, `username`, `bio`, `graduation_year`, `avatar_url`, `avatar_color`

---

## 5. Screens

### 5.1 LandingScreen
The welcome screen for unauthenticated users. Displays the Tufts Jumbo logo with a pulsing animation, floating emoji rain background, and live statistics pulled from Supabase (active event count, registered student count). Two CTAs route to Register and Login.

### 5.2 LoginScreen
Email/password sign-in form with animated entry, input focus indicators, and loading state. On success, the auth state listener in `App.js` navigates to `HomeScreen`.

### 5.3 RegisterScreen
Account creation form enforcing `@tufts.edu` email, unique username, graduation year, and password confirmation. After sign-up, the database trigger creates the user profile automatically.

### 5.4 HomeScreen
The main hub of the app. Displays:
- **Featured events carousel** with poster images (horizontal scroll)
- **Stats bar** showing total events, events this week, and free event count
- **Quick filters**: All, This Week, Free, Student Orgs
- **Category filters**: 8 event types (General, Student Orgs, Arts & Culture, Sports, Academic, Outdoors, Campus Center, Greek Life)
- **Event cards** showing title, organizer, time, location, spots remaining, and price
- **Floating action button** to create a new event

Real-time subscription updates the list when events change.

### 5.5 DiscoverScreen
Search and advanced filtering interface:
- **Search bar** with text input filtering (client-side match on title, location, organizer, tags)
- **Filter icon** opens a modal with Category, Price (Free/Paid/All), and Date (Today/This Week/This Month/All) options
- **Active filter chips** displayed below the search bar with a "Clear all" option
- **Trending searches** shown when no search query is active

### 5.6 EventDetailScreen
Full event detail view with:
- **Hero section** showing the event poster image (or gradient color fallback) extending behind the status bar
- **Organizer card** with host info
- **Details grid**: date/time, location, attendee count, capacity bar
- **Description** section
- **Reservation/purchase flow**:
  - Free events: "Reserve Spot" button -> confirmation code
  - Paid events: ticket type selector -> payment modal (mock) -> confirmation code
  - Already reserved: shows confirmation card with tap-to-copy code
  - Cancel reservation option

### 5.7 CreateEventScreen
Full event creation form with:
- **Live preview banner** reflecting current selections (poster image, icon, title, color)
- **Basic info**: title, subtitle, description, organizer name
- **Event poster**: image picker (16:9 crop, uploaded to Supabase Storage)
- **Event type**: 8 category options
- **Icon picker**: 24 emoji options
- **Color picker**: 8 gradient presets
- **Date/time/location**: manual text entry with flexible parsing (MM/DD/YYYY, H:MM AM/PM)
- **Capacity**: max attendees
- **Pricing**: free/paid toggle, base price, multiple ticket tiers
- **Tags**: add/remove custom tags
- **Featured toggle**: mark event as featured

### 5.8 MyTicketsScreen
User's reservation history split into two tabs:
- **Upcoming**: active reservations for future events
- **Past**: completed or cancelled reservations
Each ticket card shows event icon, title, organizer, status badge (Confirmed/Waitlisted/Cancelled), date, time, location, confirmation code (tap to copy), and price paid.

### 5.9 ProfileScreen
User profile with three content tabs:
- **Activity**: user's ticket history
- **Achievements**: 6 badge slots (3 unlocked, 3 locked) - currently hardcoded
- **About**: email, major, graduation year, campus

Features: avatar upload/color customization, display name/bio editing, settings modal with dark mode toggle and logout.

### 5.10 FriendsScreen
Friend management with three tabs:
- **Friends**: accepted connections with search filtering
- **Requests**: pending incoming requests with Accept/Decline
- **Discover**: suggested friends based on who you're not already connected with

### 5.11 NotificationsScreen
Notification center with filter tabs (All, Events, System). Displays unread notifications in a "New" section and read notifications in "Earlier". Supports mark-as-read, mark-all-as-read, individual delete, and clear-all. Real-time subscription for new notifications.

### 5.12 ChatScreen
Placeholder messaging screen displaying a "coming soon" banner. Shows the user's online friends list and mock conversation cards. No messaging backend exists.

---

## 6. Services

### 6.1 auth.service.js
| Method | Description |
| --- | --- |
| `signUp({ email, password, username, graduationYear })` | Creates auth user and triggers profile creation |
| `signIn({ email, password })` | Authenticates and returns session |
| `signOut()` | Destroys session |
| `getSession()` | Returns current auth session |
| `getCurrentProfile()` | Fetches authenticated user's profile row |
| `updateProfile(updates)` | Whitelisted field update on profiles table |
| `onAuthStateChange(callback)` | Subscribes to auth state events |

### 6.2 events.service.js
| Method | Description |
| --- | --- |
| `getEvents({ category, isLive })` | Fetch upcoming events with optional category/live filter |
| `getFeaturedEvents()` | Fetch events where `is_featured = true` |
| `getEventsByFilters({ eventType, isFree, timeRange })` | Advanced multi-filter query |
| `getEventById(eventId)` | Fetch single event with host and attendee count |
| `createEvent(eventData)` | Insert new event tied to authenticated user |
| `joinEvent(eventId)` | Add user as event attendee |
| `leaveEvent(eventId)` | Remove user from event attendees |
| `isAttending(eventId)` | Check if user is attending |
| `subscribeToEvents(callback)` | Realtime listener on events, attendees, and reservations tables |

### 6.3 tickets.service.js
| Method | Description |
| --- | --- |
| `reserveEvent(eventId)` | Free RSVP with confirmation code generation |
| `purchaseTicket(eventId, ticketType, price)` | Paid ticket with price validation and confirmation code |
| `cancelReservation(reservationId)` | Set reservation status to 'cancelled' |
| `getMyTickets()` | Fetch all user reservations with event details |
| `getReservationForEvent(eventId)` | Check for existing active reservation |
| `subscribeToReservations(callback)` | Realtime listener on reservations table |

**Confirmation codes:** 8-character alphanumeric string generated via `crypto.getRandomValues()`. Character set excludes ambiguous characters (O, I, L, 0, 1).

### 6.4 friends.service.js
| Method | Description |
| --- | --- |
| `getFriends()` | Fetch accepted friendships with profile data |
| `getFriendRequests()` | Fetch pending incoming requests |
| `sendFriendRequest(addresseeId)` | Create pending friendship |
| `acceptRequest(friendshipId)` | Accept and update to 'accepted' |
| `declineRequest(friendshipId)` | Decline and update to 'declined' |
| `removeFriend(friendshipId)` | Delete friendship row |
| `getSuggestedFriends()` | Fetch users not already connected |
| `subscribeFriendships(callback)` | Realtime listener on friendships table |

### 6.5 notifications.service.js
| Method | Description |
| --- | --- |
| `getNotifications()` | Fetch last 50 notifications for user |
| `markAsRead(notificationId)` | Mark single notification as read (ownership-checked) |
| `markAllAsRead()` | Mark all user's unread notifications as read |
| `deleteNotification(notificationId)` | Delete single notification (ownership-checked) |
| `clearAll()` | Delete all user's notifications |
| `subscribeToNotifications(callback)` | Realtime listener for new notifications |

### 6.6 storage.service.js
| Method | Description |
| --- | --- |
| `uploadProfileImage(uri)` | Upload avatar to `avatars` bucket, update profile |
| `deleteProfileImage()` | Remove avatar files and clear profile URL |

---

## 7. Database Schema

### Tables

**profiles**
| Column | Type | Notes |
| --- | --- | --- |
| id | UUID (PK) | FK to auth.users |
| username | TEXT | Unique, required |
| display_name | TEXT | |
| email | TEXT | |
| bio | TEXT | Default '' |
| graduation_year | TEXT | |
| avatar_url | TEXT | |
| avatar_color | TEXT | Default '#6AADE4' |
| is_verified | BOOLEAN | Default false |
| joined_date | TEXT | |
| events_attended | INTEGER | Default 0 |
| tickets_count | INTEGER | Default 0 |
| vibe_score | INTEGER | Default 50 |
| created_at | TIMESTAMPTZ | Auto |
| updated_at | TIMESTAMPTZ | Auto via trigger |

**events**
| Column | Type | Notes |
| --- | --- | --- |
| id | UUID (PK) | Auto-generated |
| title | TEXT | Required |
| subtitle | TEXT | |
| description | TEXT | |
| icon | TEXT | Default '🎉' |
| color | TEXT | Default '#6AADE4' |
| gradient_colors | TEXT[] | Default Tufts blue gradient |
| category | TEXT | Default 'General' |
| location | TEXT | |
| distance | TEXT | |
| start_time | TIMESTAMPTZ | Required |
| end_time | TIMESTAMPTZ | Required |
| max_capacity | INTEGER | Default 100 |
| tags | TEXT[] | Default '{}' |
| energy | INTEGER | Default 50 |
| vibe | TEXT | Default 'Active' |
| ticket_price | DECIMAL | Default 0 |
| is_free | BOOLEAN | Generated: ticket_price = 0 |
| requires_reservation | BOOLEAN | Default true |
| event_type | TEXT | Default 'general' |
| organizer_name | TEXT | |
| organizer_icon | TEXT | Default Tufts Jumbo |
| image_url | TEXT | Poster image URL |
| ticket_types | JSONB | Default '[]' |
| is_featured | BOOLEAN | Default false |
| created_by | UUID | FK to profiles |
| created_at | TIMESTAMPTZ | Auto |
| updated_at | TIMESTAMPTZ | Auto via trigger |

**event_attendees**
| Column | Type | Notes |
| --- | --- | --- |
| id | UUID (PK) | |
| event_id | UUID | FK to events (cascade) |
| user_id | UUID | FK to profiles (cascade) |
| joined_at | TIMESTAMPTZ | Default now() |
| | | Unique(event_id, user_id) |

**event_reservations**
| Column | Type | Notes |
| --- | --- | --- |
| id | UUID (PK) | |
| event_id | UUID | FK to events (cascade) |
| user_id | UUID | FK to profiles (cascade) |
| status | TEXT | 'confirmed' / 'waitlisted' / 'cancelled' |
| reservation_type | TEXT | 'free_rsvp' / 'ticket_purchase' |
| ticket_type | TEXT | Default 'general' |
| price_paid | DECIMAL | Default 0 |
| confirmation_code | TEXT | Required, 8-char alphanumeric |
| purchased_at | TIMESTAMPTZ | Default now() |
| created_at | TIMESTAMPTZ | Default now() |
| | | Unique(event_id, user_id) |

**friendships**
| Column | Type | Notes |
| --- | --- | --- |
| id | UUID (PK) | |
| requester_id | UUID | FK to profiles (cascade) |
| addressee_id | UUID | FK to profiles (cascade) |
| status | TEXT | 'pending' / 'accepted' / 'declined' |
| created_at | TIMESTAMPTZ | Auto |
| updated_at | TIMESTAMPTZ | Auto via trigger |
| | | Unique(requester_id, addressee_id) |

**notifications**
| Column | Type | Notes |
| --- | --- | --- |
| id | UUID (PK) | |
| user_id | UUID | FK to profiles (cascade) |
| type | TEXT | Default 'system' |
| icon | TEXT | Default bell emoji |
| title | TEXT | Required |
| body | TEXT | |
| category | TEXT | Default 'system' |
| color | TEXT | Default '#6AADE4' |
| read | BOOLEAN | Default false |
| created_at | TIMESTAMPTZ | Auto |

### Row Level Security

All tables have RLS enabled. Summary of policies:

| Table | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| profiles | Public | Own only | Own only | - |
| events | Public | Creator only | Creator only | Creator only |
| event_attendees | Public | Own only | - | Own only |
| event_reservations | Own + event host | Own only | Own only | Own only |
| friendships | Participants only | Requester only | Participants | Participants |
| notifications | Own only | Own only | Own only | Own only |

### Database Functions

| Function | Trigger | Description |
| --- | --- | --- |
| `handle_new_user()` | After INSERT on auth.users | Creates profile row + welcome notification |
| `handle_event_join()` | After INSERT on event_attendees | Notifies event creator |
| `handle_friend_request()` | After INSERT on friendships | Notifies addressee |
| `handle_friend_accepted()` | After UPDATE on friendships | Notifies requester when accepted |
| `handle_reservation_created()` | After INSERT on event_reservations | Notifies user + event creator |
| `handle_updated_at()` | Before UPDATE on various | Auto-updates `updated_at` column |
| `get_attendee_count(event_uuid)` | - | Returns attendee count for event |
| `get_mutual_friends_count(a, b)` | - | Returns mutual friend count |
| `get_friend_count(user_uuid)` | - | Returns accepted friend count |
| `generate_confirmation_code()` | - | SQL-level 8-char code generator |

### Performance Indexes

| Index | Table | Column(s) |
| --- | --- | --- |
| idx_events_start_time | events | start_time |
| idx_events_event_type | events | event_type |
| idx_events_is_featured | events | is_featured (partial: WHERE true) |
| idx_profiles_username | profiles | username |
| idx_event_attendees_event_id | event_attendees | event_id |
| idx_reservations_event_user | event_reservations | (event_id, user_id) |
| idx_friendships_requester | friendships | requester_id |
| idx_friendships_addressee | friendships | addressee_id |
| idx_friendships_status | friendships | status |
| idx_notifications_user | notifications | user_id |
| idx_notifications_read | notifications | read |

---

## 8. Storage

Two Supabase Storage buckets:

| Bucket | Visibility | Purpose |
| --- | --- | --- |
| `avatars` | Public read | Profile pictures. Path: `{user_id}/avatar.{ext}` |
| `event-images` | Public read | Event poster images. Path: `event-posters/{timestamp}.{ext}` |

**Upload policies:**
- Authenticated users can upload to both buckets
- Public can read from both buckets
- Users can delete their own files from `event-images`
- Accepted file types (avatars): jpg, jpeg, png, gif, webp

---

## 9. Real-Time Subscriptions

The app uses Supabase Realtime (Postgres Changes) for live updates:

| Screen | Channel | Tables Watched |
| --- | --- | --- |
| HomeScreen | events-changes | events, event_attendees, event_reservations |
| EventDetailScreen | (inherits from Home) | - |
| MyTicketsScreen | reservations | event_reservations |
| FriendsScreen | friendships | friendships |
| NotificationsScreen | notifications | notifications |

All subscriptions are cleaned up on component unmount via `useEffect` return callbacks.

---

## 10. Theming

The app supports light and dark themes via `ThemeContext`.

**Default:** Dark mode

**Storage:** Theme preference persisted in AsyncStorage under key `jumbonow_theme`.

**Brand colors (Tufts):**
- Primary Blue: `#418FDE`
- Light Blue: `#6AADE4`
- Dark Blue: `#3579C6`
- Silver: `#A8B8C8`

**Color tokens (24 total):** background, surface, surfaceAlt, card, cardBorder, text, textSecondary, textTertiary, textMuted, accent, accentBg, accentBorder, accentMuted, buttonPrimary, buttonSecondary, inputBg, placeholder, divider, error, success, info, warning, modalOverlay, statusBarStyle.

---

## 11. Navigation

**Library:** @react-navigation/native-stack v7

**Stack structure:**
```
NavigationContainer
└── NativeStackNavigator (screenOptions: headerShown: false)
    ├── [Unauthenticated]
    │   ├── Landing
    │   ├── Login
    │   └── Register
    │
    └── [Authenticated]
        ├── Home           (BottomNav: Events)
        ├── Profile        (BottomNav: Profile)
        ├── Notifications
        ├── Friends
        ├── Discover       (BottomNav: Discover)
        ├── EventDetail    (params: { eventId })
        ├── MyTickets      (BottomNav: My Tickets)
        ├── CreateEvent
        └── Chat
```

**Bottom navigation tabs:** Events (Home), Discover, My Tickets, Profile

---

## 12. Environment Variables

| Variable | Required | Description |
| --- | --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous/public API key |
| `SUPABASE_URL` | Scraper only | Supabase URL for Node.js scraper |
| `SUPABASE_SERVICE_KEY` | Scraper only | Supabase service role key (admin) |

---

## 13. Scripts

### Development
```bash
npm start          # Start Expo dev server
npm run ios        # Run on iOS simulator
npm run android    # Run on Android emulator
npm run web        # Run in browser
```

### Data Import
```bash
node scripts/scrape-ocl.js    # Import events from Tufts OCL / tuftstickets.com
```

The scraper fetches event data from the Tufts ticketing website, parses HTML for event details, enriches them with icons/colors/tags, and upserts into the Supabase `events` table using the service role key. Includes a hardcoded fallback list of known Tufts events.
