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
7. [Components](#7-components)
8. [Database Schema](#8-database-schema)
9. [Storage](#9-storage)
10. [Real-Time Subscriptions](#10-real-time-subscriptions)
11. [External APIs](#11-external-apis)
12. [Theming](#12-theming)
13. [Navigation](#13-navigation)
14. [Security](#14-security)
15. [Testing](#15-testing)
16. [Environment Variables](#16-environment-variables)
17. [Scripts](#17-scripts)

---

## 1. Overview

JumboNow is a mobile campus platform built for Tufts University students. Students can browse campus events, reserve spots or purchase tickets, manage friendships, track dining menus with real logos, find free food, navigate campus with live shuttle tracking, and access 15 campus resources -- all in one app.

**Core capabilities:**
- Event browsing with search, filters, and featured events carousel
- Free RSVP and paid ticket purchases with QR-coded confirmation codes
- Event creation with logo/poster upload, ticket tiers, and tagging
- Friend system with requests, groups, messaging, and real-time updates
- Dining menus with real Nutrislice logos and live operating status
- Live shuttle tracking with Passio GO integration and route schedules
- Campus resources hub with 15 quick-access tiles
- Push notification system with categorized alerts
- User profiles with campus resources tab and vibe score
- Light and dark theme support
- Real-time data sync via Supabase Realtime

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
| QR Codes           | react-native-qrcode-svg                 | 6.3.21    |
| Maps               | react-native-maps                       | 1.20.1    |
| Image Picker       | expo-image-picker                       | 17.0.10   |
| Clipboard          | expo-clipboard                          | 8.0.8     |
| Safe Area          | react-native-safe-area-context          | 5.6.0     |
| Dining API         | Nutrislice (no key required)            | --        |
| Shuttle API        | Passio GO (System ID: 6670)             | --        |
| Routing            | OSRM (no key required)                  | --        |

---

## 3. Project Structure

```
JumboNow/
├── App.js                          # Entry point, ErrorBoundary, navigation, deep linking
├── app.json                        # Expo configuration
├── package.json                    # Dependencies and scripts
├── index.js                        # registerRootComponent
├── jest.setup.js                   # Test setup and mocks
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
│   ├── hooks/
│   │   └── usePushNotifications.js # Push notification registration + handling
│   │
│   ├── components/
│   │   ├── BottomNav.js            # Tab bar (Map, Friends, Events, Tickets, Profile)
│   │   ├── FreeFoodBanner.js       # Real-time push banner for free food alerts
│   │   └── SmartIcon.js            # Universal URL-image / emoji-text renderer
│   │
│   ├── data/
│   │   ├── campusLocations.js      # 19 campus locations with coordinates
│   │   └── diningLocations.js      # 11 dining locations with logos + Transact links
│   │
│   ├── services/
│   │   ├── auth.service.js         # Authentication and profile management
│   │   ├── events.service.js       # Event CRUD, filtering, attendance
│   │   ├── tickets.service.js      # Reservations and ticket purchases
│   │   ├── friends.service.js      # Friend requests, suggestions
│   │   ├── friendGroups.service.js # Friend group CRUD and membership
│   │   ├── chat.service.js         # Conversations and messages
│   │   ├── notifications.service.js# Notification management
│   │   ├── freefood.service.js     # Free food posts and subscriptions
│   │   ├── dining.service.js       # Nutrislice API integration
│   │   ├── achievements.service.js # Achievement definitions and unlocking
│   │   ├── reports.service.js      # Content reporting with validation
│   │   └── storage.service.js      # Avatar image upload/delete
│   │
│   └── screens/
│       ├── LandingScreen.js        # Welcome screen (unauthenticated)
│       ├── LoginScreen.js          # Email/password login
│       ├── RegisterScreen.js       # Account creation (@tufts.edu)
│       ├── EmailVerificationScreen.js # Email confirmation flow
│       ├── OnboardingScreen.js     # First-time user onboarding
│       ├── HomeScreen.js           # Main feed with featured events + FAB
│       ├── DiscoverScreen.js       # Search + advanced filters
│       ├── EventDetailScreen.js    # Full event view + ticketing
│       ├── CreateEventScreen.js    # Event creation with logo/poster upload
│       ├── MyTicketsScreen.js      # Reservations with QR codes
│       ├── ProfileScreen.js        # Profile + campus resources + settings
│       ├── FriendsScreen.js        # Friends, requests, groups
│       ├── ChatScreen.js           # Direct messaging
│       ├── NotificationsScreen.js  # Notification center
│       ├── DiningScreen.js         # Dining locations with button filters
│       ├── DiningMenuScreen.js     # Meal period menus with nutrition
│       ├── FreeFoodScreen.js       # Free food alert map
│       ├── MapScreen.js            # Campus map + live shuttle tracker
│       └── CampusResourcesScreen.js# Campus resources grid (standalone)
│
└── supabase/
    ├── config.toml                 # Supabase project configuration
    └── migrations/                 # 22 SQL migrations
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

**Profile update security:**
- `authService.updateProfile(updates)` applies a field allowlist:
- Allowed fields: `display_name`, `username`, `bio`, `graduation_year`, `avatar_url`, `avatar_color`, `account_type`
- Disallowed fields (silently stripped): `id`, `email`, `is_verified`, `vibe_score`, etc.

---

## 5. Screens

### 5.1 LandingScreen
Welcome screen for unauthenticated users. Pulsing Jumbo logo, floating emoji rain, live stats from Supabase, and Register/Login CTAs.

### 5.2 LoginScreen
Email/password sign-in with animated entry and loading state.

### 5.3 RegisterScreen
Account creation enforcing `@tufts.edu` email, unique username, graduation year, and password confirmation. Supports student/club/staff account types.

### 5.4 HomeScreen
Main hub displaying:
- **Featured events carousel** with poster images (75% screen width cards)
- **Quick filters**: All Events, Friends' Events, This Week (with persistent state)
- **Category filters**: 8 event types as scrollable pills
- **Event cards** with SmartIcon for logos/emojis
- **FAB menu**: Create Event, Dining & Food (with nested Free Food sub-item)

### 5.5 DiscoverScreen
Search + advanced filtering with debounced text input, filter modal (category, price, date), active filter chips, and trending searches. Best accessibility coverage in the app.

### 5.6 EventDetailScreen
Event detail with hero image, organizer card with SmartIcon, details grid, and reservation/purchase flow. QR code display on confirmed reservations.

### 5.7 CreateEventScreen
Event creation with:
- **Logo upload**: Pick image from device, upload to Supabase Storage (`org-logos/` folder)
- **Poster image**: 16:9 crop, uploaded to `event-posters/` folder
- **File validation**: Extension allowlist (jpg, jpeg, png, gif, webp) and size limits (5MB logos, 10MB posters)
- Live preview banner, emoji grid fallback, ticket tiers, tags

### 5.8 MyTicketsScreen
Reservations split into Upcoming/Past tabs. Each ticket shows:
- SmartIcon for event icon, title, organizer, status badge
- QR code generated from confirmation code (tap to toggle)
- Apple Wallet button (iOS only, upcoming confirmed tickets only)
- 1-5 star rating with feedback for past events

### 5.9 ProfileScreen
User profile with three content tabs:
- **Activity**: User's ticket history with SmartIcon event icons
- **Campus**: 15 campus resource tiles (Dining, Canvas, Shuttle, Health, Safety, Fitness, Athletics, Apps, Laundry, Parking, Technology, Free Food, Map, Study Spaces, Reserve Tufts) with in-app navigation or external links
- **About**: Email, major, graduation year, campus

Settings modal with dark mode toggle, help, feedback, and logout.

### 5.10 FriendsScreen
Friend management with three tabs: Friends, Requests, Discover.

### 5.11 NotificationsScreen
Notification center with filter tabs (All, Events, System), mark-as-read, and real-time subscription.

### 5.12 ChatScreen
Direct messaging with real-time delivery.

### 5.13 DiningScreen
Dining locations with:
- **Equal-width button filters** (All, Dining Halls, Cafes, Grab & Go) using `flex:1`
- Real dining logos via SmartIcon (from Nutrislice API)
- Live open/closed/closing-soon status badges
- Tap to navigate to DiningMenuScreen

### 5.14 DiningMenuScreen
Individual dining hall menu with:
- Meal period tabs with gradient active styling (breakfast=gold, lunch=green, dinner=purple)
- Expandable menu items with nutrition info
- "Order on Transact" floating button for supported locations
- SmartIcon header with dining logo

### 5.15 MapScreen
Dual-mode interactive map:

**Campus Mode:**
- 19 campus locations across 5 categories
- Category filter pills, location cards, walking directions
- "View Menu" button on dining locations

**Shuttle Mode:**
- Live bus markers with 10-second auto-refresh via Passio GO API
- Route pills with color coding, bus count badges, and "Inactive" labels
- Route polylines following roads via OSRM
- Bus detail popup (name, route, speed, live indicator)
- Route schedule panel with service days, hours, frequency, route description
- Dismissible holiday schedule alert banner
- "Live Tracking on Passio GO" external link
- Walking navigation to stops with distance and ETA

### 5.16 CampusResourcesScreen
Standalone campus resources grid with favorites and search.

---

## 6. Services

### 6.1 auth.service.js
| Method | Description |
| --- | --- |
| `signUp({ email, password, username, graduationYear, accountType })` | Creates auth user with metadata |
| `signIn({ email, password })` | Authenticates and returns session |
| `signOut()` | Destroys session |
| `getSession()` | Returns current auth session |
| `getCurrentProfile()` | Fetches authenticated user's profile |
| `updateProfile(updates)` | Allowlisted field update on profiles table |
| `onAuthStateChange(callback)` | Subscribes to auth state events |

### 6.2 events.service.js
| Method | Description |
| --- | --- |
| `getEvents({ category, isLive })` | Fetch upcoming events with optional filters |
| `getFeaturedEvents()` | Fetch events where `is_featured = true` |
| `getEventsByFilters({ eventType, isFree, timeRange })` | Multi-filter query |
| `getFriendsEvents({ page })` | Get events friends are attending |
| `searchEvents(query)` | Full-text search with sanitization + fallback |
| `getEventById(eventId)` | Fetch single event with details |
| `createEvent(eventData)` | Insert new event (rate-limited) |
| `subscribeToEvents(callback)` | Realtime listener |

### 6.3 tickets.service.js
| Method | Description |
| --- | --- |
| `reserveEvent(eventId)` | Free RSVP with crypto-secure confirmation code |
| `purchaseTicket(eventId, ticketType, price)` | Paid ticket with confirmation code |
| `cancelReservation(reservationId)` | Cancel reservation |
| `getMyTickets()` | Fetch all user reservations with event details |
| `submitRating(reservationId, rating, feedback)` | Submit event rating |
| `getWalletPassUrl(reservationId)` | Generate Edge Function URL for wallet pass |

### 6.4 friends.service.js
| Method | Description |
| --- | --- |
| `getFriends()` | Fetch accepted friendships |
| `getFriendRequests()` | Fetch pending incoming requests |
| `sendFriendRequest(addresseeId)` | Create pending friendship (rate-limited) |
| `acceptRequest(friendshipId)` | Accept request |
| `removeFriend(friendshipId)` | Delete friendship |
| `getSuggestedFriends()` | Fetch non-connected users |
| `searchFriends(query)` | Search by username/display name with sanitization |

### 6.5 dining.service.js
| Method | Description |
| --- | --- |
| `getSchools()` | Fetch all dining locations with logos and hours |
| `getMenu(slug, mealType, date)` | Fetch menu for specific location/meal/date |

### 6.6 reports.service.js
| Method | Description |
| --- | --- |
| `reportContent({ reportedType, reportedId, reason, details })` | Submit report with validation |

Validates: report type (event/user/message/free_food), reason (spam/inappropriate/...), details length (max 1000 chars).

---

## 7. Components

### 7.1 SmartIcon
Universal icon renderer that detects if a value is an HTTPS URL or emoji string.
- URL values: Renders as `<Image>` with configurable size and border radius
- Emoji values: Renders as `<Text>` with proportional font size
- Only accepts `https://` URLs (HTTP rejected for security)
- Used across all screens for event icons, dining logos, organizer avatars

### 7.2 BottomNav
Five-tab navigation bar: Map, Friends, Events (center), Tickets, Profile.

### 7.3 FreeFoodBanner
Real-time push banner that appears when a new free food alert is posted.

---

## 8. Database Schema

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
| account_type | TEXT | Default 'student' |
| vibe_score | INTEGER | Default 50 |
| created_at | TIMESTAMPTZ | Auto |
| updated_at | TIMESTAMPTZ | Auto via trigger |

**events**
| Column | Type | Notes |
| --- | --- | --- |
| id | UUID (PK) | Auto-generated |
| title | TEXT | Required |
| icon | TEXT | Emoji or URL (via SmartIcon) |
| organizer_icon | TEXT | Emoji or uploaded logo URL |
| image_url | TEXT | Poster image URL |
| category | TEXT | Default 'General' |
| ticket_price | DECIMAL | Default 0 |
| is_free | BOOLEAN | Generated: ticket_price = 0 |
| is_featured | BOOLEAN | Default false |
| created_by | UUID | FK to profiles |

**event_reservations**
| Column | Type | Notes |
| --- | --- | --- |
| confirmation_code | TEXT | 8-char crypto-secure alphanumeric |
| rating | INTEGER | CHECK (1-5), set after event |
| feedback | TEXT | Optional rating feedback |
| UNIQUE | | (event_id, user_id) |

### Row Level Security

All tables have RLS enabled with ownership-scoped policies.

### Database Functions

| Function | Purpose |
| --- | --- |
| `reserve_event_with_capacity()` | Atomic RSVP with row-level capacity lock |
| `purchase_ticket_with_inventory()` | Atomic ticket purchase with inventory check |
| `check_rate_limit(user_id, action, max, window_min)` | Per-action rate limiting |
| `check_and_unlock_achievements(user_id)` | Achievement check and unlock |

---

## 9. Storage

Three usage areas in Supabase Storage:

| Bucket | Folder | Purpose | Validation |
| --- | --- | --- | --- |
| `avatars` | `{user_id}/` | Profile pictures | Extension allowlist + 5MB limit |
| `event-images` | `org-logos/` | Organization logos | Extension allowlist + 5MB limit |
| `event-images` | `event-posters/` | Event poster images | Extension allowlist + 10MB limit |

**Allowed extensions**: jpg, jpeg, png, gif, webp

---

## 10. Real-Time Subscriptions

| Screen | Tables Watched |
| --- | --- |
| HomeScreen | events, event_attendees, event_reservations |
| MyTicketsScreen | event_reservations |
| FriendsScreen | friendships |
| NotificationsScreen | notifications |
| ChatScreen | messages |
| FreeFoodScreen | free_food_posts |

All subscriptions cleaned up on component unmount.

---

## 11. External APIs

### Nutrislice (Dining)
- Base URL: `https://tufts.api.nutrislice.com/menu/api`
- Returns: location info, logos, hours, menus with full nutrition
- Caching: Schools 1hr, menus 30min
- No API key required

### Passio GO (Shuttle)
- Base URL: `https://passio3.com/www/mapGetData.php`
- System ID: 6670
- Returns: routes, live bus GPS, stops with route assignments
- Polling: 10-second interval for bus positions

### OSRM (Routing)
- URL: `https://router.project-osrm.org/route/v1/{mode}/{coords}`
- Used for: shuttle route polylines, walking directions
- No API key required

---

## 12. Theming

**Default:** Dark mode. Stored in AsyncStorage key `@jumbo_now_theme`.

**Tufts brand colors:**
- Primary Blue: `#418FDE`
- Light Blue: `#6AADE4`
- Dark Blue: `#3579C6`
- Silver: `#A8B8C8`

24 color tokens covering background, surface, text, accent, buttons, inputs, and status colors. All screens use `createStyles(colors)` pattern.

---

## 13. Navigation

**Library:** @react-navigation/native-stack v7

**19 registered screens** in `App.js`:
Landing, Login, Register, EmailVerification, Onboarding, Home, Profile, Notifications, Friends, Discover, EventDetail, MyTickets, CreateEvent, Chat, Map, FreeFood, Dining, DiningMenu, CampusResources

**Deep linking** via `jumbonow://` and `https://jumbonow.app` prefixes.

---

## 14. Security

**Implemented protections:**
- Profile update field allowlist (strips unauthorized fields like `id`, `email`, `is_verified`)
- Search input sanitization (removes `,()\\` before PostgREST filter interpolation)
- Server-side rate limiting via `check_rate_limit` RPC
- Row-Level Security on all 18 Supabase tables
- Cryptographically secure confirmation codes (`crypto.getRandomValues` with fallback)
- Image upload validation: extension allowlist + size limits
- HTTPS-only URL rendering in SmartIcon component
- 5-second fetch timeouts via AbortController
- UUID validation on friend suggestions
- Content report validation (type, reason, details length)

**Known considerations:**
- Auth tokens stored in AsyncStorage (consider migrating to expo-secure-store)
- Deep links should be guarded by authentication state
- Console logging should be disabled in production builds

---

## 15. Testing

**Framework:** Jest 29 + jest-expo + @testing-library/react-native

**5 test suites, 24 tests:**

| Suite | Tests | Coverage |
| --- | --- | --- |
| auth.service.test.js | 3 | Signup metadata, profile allowlist, error handling |
| events.service.test.js | 3 | Friends events, create retry, search sanitization |
| tickets.service.test.js | 2 | Wallet pass URL, session handling |
| reports.service.test.js | 5 | Type validation, reason validation, length check, auth requirement |
| MyTicketsScreen.test.js | 5 | Ticket count badge, Apple Wallet (iOS/Android/cancelled/past) |

**Mocks** configured in `jest.setup.js`: Supabase client, ThemeContext, SafeAreaContext, expo modules, lucide icons, BottomNav.

---

## 16. Environment Variables

| Variable | Required | Description |
| --- | --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous/public API key |

### AsyncStorage Keys

| Key | Purpose |
| --- | --- |
| `@jumbo_now_theme` | Theme preference (dark/light) |
| `jumbonow_onboarding_done` | Onboarding completion flag |
| `jumbonow_home_filters` | Home screen filter persistence |
| `jumbonow_discover_filters` | Discover screen filter persistence |
| `jumbonow_saved_events` | Saved/bookmarked event IDs |
| `jumbonow_account_type` | Account type from registration |

---

## 17. Scripts

```bash
npm start          # Start Expo dev server
npm run ios        # Run on iOS simulator
npm run android    # Run on Android emulator
npm run web        # Run in browser
npm test           # Run all tests (5 suites, 24 tests)
```

### Data Import
```bash
node scripts/scrape-ocl.js    # Import events from Tufts OCL / tuftstickets.com
```
