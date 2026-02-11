# JumboNow

A full-featured campus app for Tufts University students. Discover events, connect with friends, track dining menus, find free food, navigate campus, and catch the shuttle — all in one place.

Built with React Native and Expo, powered by Supabase.

---

## Features

### Events

- Browse and search campus events with full-text search
- Filter by category (student orgs, arts, sports, academic, outdoors, greek life)
- Filter by price (free/paid), time range (today, this week, this month)
- Featured events carousel on the home screen
- Create events with custom icons, colors, capacity limits, and ticket pricing
- RSVP to free events or purchase tickets with confirmation codes
- Invite friends or entire friend groups to events
- Rate and review events after attending
- Trending search suggestions based on community activity

### Social

- Add friends, accept/decline requests, view suggested friends
- Create named friend groups with custom icons and colors
- Direct messaging with real-time delivery and read receipts
- Notification feed for event invites, RSVPs, messages, and food alerts
- User profiles with bio, major, graduation year, vibe score, and achievements

### Dining

- Real-time menus for all 11 Tufts dining locations via the Nutrislice API
- Filter by type: Dining Halls, Cafes, Grab & Go
- Live open/closed/closing-soon status
- Meal period tabs (Breakfast, Lunch, Dinner, Late Night)
- Expandable menu items with full nutrition info (calories, protein, carbs, fat, fiber, sodium)
- Dietary icon badges and ingredient lists
- One-tap mobile ordering via Transact for supported locations

### Free Food

- Post and discover free food alerts across campus
- Map view with food type categories (pizza, sandwiches, snacks, drinks, baked goods, fruit, full meal)
- Custom emoji, location pin, and expiration timer per post
- Subscribe for real-time push banner notifications when new food is posted
- Auto-expiry after 2 hours (configurable up to 3 hours)

### Campus Map

- Interactive map with 19 campus locations across 5 categories
- Location categories: Libraries, Dining, Academic, Athletic, Residential
- Estimated traffic/busyness levels by time of day
- Walking directions with distance and duration via OSRM
- "View Menu" button on dining locations links directly to that hall's menu

### Shuttle Tracker

- Live GPS positions of all active Tufts shuttles via the Passio GO API
- Route filtering with color-coded pills and active bus count badges
- Road-following route polylines rendered on the map
- Stop markers with tap-to-select and walking directions
- 10-second auto-refresh for real-time bus positions
- Walking navigation overlay with distance and ETA

### Achievements

- Unlock achievements for milestones (first event, 5 saved events, first ticket, event creation, etc.)
- Vibe score tracking based on engagement
- Achievement badges displayed on profile

### Tickets

- View all reservations and purchased tickets
- Confirmation codes for event check-in
- Rate events after attending (1-5 stars with optional feedback)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React Native 0.81.5 / Expo SDK 54 |
| Navigation | React Navigation 7 (Native Stack) |
| Backend | Supabase (PostgreSQL, Auth, Realtime, Storage, Edge Functions) |
| Dining API | Nutrislice (no key required) |
| Shuttle API | Passio GO |
| Routing | OSRM (free, no key required) |
| Maps | react-native-maps with Google Maps provider |
| Icons | lucide-react-native |
| Theme | Custom ThemeContext with dark/light mode |
| Storage | AsyncStorage for local persistence |

---

## Project Structure

```
JumboNow/
  App.js                          # Root component, navigation, deep linking, error boundary
  app.json                        # Expo configuration
  package.json                    # Dependencies and scripts
  index.js                        # Entry point
  tsconfig.json                   # TypeScript configuration
  jest.setup.js                   # Test setup

  src/
    config/
      supabase.js                 # Supabase client initialization

    context/
      ThemeContext.js              # Dark/light theme provider with Tufts colors

    components/
      BottomNav.js                # Tab bar (Map, Friends, Events, Tickets, Profile)
      FreeFoodBanner.js           # Real-time push banner for new free food alerts

    data/
      campusLocations.js          # 19 hardcoded campus locations with coordinates
      diningLocations.js          # 11 dining hall slug mappings and Transact links

    screens/
      LandingScreen.js            # Welcome screen with login/register options
      LoginScreen.js              # Email/password login
      RegisterScreen.js           # Registration (email, password, username, grad year)
      EmailVerificationScreen.js  # Email confirmation flow
      OnboardingScreen.js         # First-time user onboarding

      HomeScreen.js               # Main feed: featured events, filters, FAB menu
      DiscoverScreen.js           # Search events with advanced filters
      EventDetailScreen.js        # Event details, RSVP/buy, invite, rate
      CreateEventScreen.js        # Create event form
      MyTicketsScreen.js          # Reservations and tickets with ratings

      ProfileScreen.js            # User profile, stats, achievements, settings
      FriendsScreen.js            # Friend list, requests, groups, search
      ChatScreen.js               # Direct messaging conversations
      NotificationsScreen.js      # Notification feed

      DiningScreen.js             # Dining locations list with filters
      DiningMenuScreen.js         # Individual dining hall menu by meal period
      FreeFoodScreen.js           # Free food alert map and creation
      MapScreen.js                # Interactive campus map with directions
      ShuttleScreen.js            # Live shuttle tracker with walking nav

    services/
      auth.service.js             # Authentication (signup, login, profiles)
      events.service.js           # Events CRUD, search, RSVP, invitations
      tickets.service.js          # Reservations, purchases, ratings, wallet
      friends.service.js          # Friendships, requests, search, suggestions
      friendGroups.service.js     # Friend group CRUD and membership
      chat.service.js             # Conversations and messages
      notifications.service.js    # Notification feed management
      freefood.service.js         # Free food posts and subscriptions
      dining.service.js           # Nutrislice API integration
      achievements.service.js     # Achievement definitions and unlocking
      reports.service.js          # Content reporting
      storage.service.js          # Profile image upload/delete

    utils/
      safeColor.js                # Color validation utility

    services/__tests__/           # Service unit tests
    screens/__tests__/            # Screen component tests

  supabase/
    config.toml                   # Supabase project configuration
    migrations/                   # 22 SQL migrations (schema, RLS, functions, triggers, seeds)

  assets/                         # App icons, splash screen, images
  scripts/                        # Utility scripts
```

---

## Navigation

### Screen Flow

```
Landing --> Login -----> Home (authenticated)
       \-> Register --> EmailVerification --> Onboarding --> Home
```

### Bottom Tab Bar

| Tab | Screen | Icon |
|-----|--------|------|
| Map | MapScreen | Map pin |
| Friends | FriendsScreen | Users |
| Events (center) | HomeScreen | Calendar |
| Tickets | MyTicketsScreen | Ticket |
| Profile | ProfileScreen | User |

### Additional Screens (navigated via buttons/links)

| Screen | Access |
|--------|--------|
| Discover | Search icon on HomeScreen |
| EventDetail | Tap any event card |
| CreateEvent | FAB menu on HomeScreen |
| Chat | Chat icon on HomeScreen header |
| Notifications | Bell icon on HomeScreen header |
| Dining | FAB menu on HomeScreen |
| DiningMenu | Tap a dining location or "View Menu" on MapScreen |
| FreeFood | FAB menu on HomeScreen or push banner |
| Shuttle | Shuttle icon on MapScreen |

### Deep Links

| URL | Screen |
|-----|--------|
| `jumbonow://home` | HomeScreen |
| `jumbonow://event/:eventId` | EventDetailScreen |
| `jumbonow://profile` | ProfileScreen |
| `jumbonow://friends` | FriendsScreen |
| `jumbonow://tickets` | MyTicketsScreen |
| `jumbonow://map` | MapScreen |
| `jumbonow://freefood` | FreeFoodScreen |
| `jumbonow://dining` | DiningScreen |
| `jumbonow://dining/:slug` | DiningMenuScreen |

---

## External APIs

### Supabase

The entire backend: authentication, database, real-time subscriptions, file storage.

- **Auth**: Email/password signup and login, email verification, session management
- **Database**: PostgreSQL with Row-Level Security on all tables
- **Realtime**: Live updates for events, messages, notifications, free food posts, friendships
- **Storage**: Profile image uploads (`avatars` bucket), event images (`event-images` bucket)
- **Edge Functions**: Wallet pass generation (planned)

### Nutrislice (Dining Menus)

Public API, no key required.

```
Base URL: https://tufts.api.nutrislice.com/menu/api

GET /schools/?format=json                                          # All dining locations
GET /weeks/school/{slug}/menu-type/{meal}/{year}/{month}/{day}/    # Menu for a day
```

Returns: location hours, operating status, meal types, menu items with full nutrition, dietary icons, and ingredients.

**Caching**: Schools cached 1 hour, menus cached 30 minutes per location/meal/date.

### Passio GO (Shuttle Tracking)

Tufts shuttle real-time data.

```
Base URL: https://passio3.com/www/mapGetData.php
System ID: 6670

POST ?getRoutes=1    # All shuttle routes
POST ?getBuses=1     # Live bus GPS positions
POST ?getStops=2     # All stops with route assignments
```

Returns: route names/colors, real-time bus coordinates and headings, stop positions with route associations.

**Polling**: Bus positions refresh every 10 seconds.

### OSRM (Walking/Driving Directions)

Free routing engine, no key required.

```
GET https://router.project-osrm.org/route/v1/driving/{coords}?overview=full&geometries=polyline
```

Used for: shuttle route polylines on the map and walking directions to stops and campus locations.

### Transact Mobile Ordering

Deep link to the Transact app for food ordering at supported dining locations.

```
Deep link:  transactmobileordering://
iOS store:  https://apps.apple.com/us/app/transact-mobile-ordering/id1495670313
Android:    https://play.google.com/store/apps/details?id=com.compass.transact
```

Supported locations: Hodgdon, Hotung, Commons, Late Night at Commons.

---

## Database

### Tables

| Table | Purpose |
|-------|---------|
| `profiles` | User profiles extending Supabase auth (username, bio, major, vibe score, avatar) |
| `events` | All event data (title, time, location, capacity, pricing, category) |
| `event_attendees` | Join table tracking who's attending each event |
| `event_reservations` | RSVPs and ticket purchases with confirmation codes and ratings |
| `event_invitations` | Friend-to-friend event invitations with accept/decline |
| `friendships` | Friend relationships with pending/accepted status |
| `friend_groups` | Named friend groups owned by users |
| `friend_group_members` | Group membership join table |
| `conversations` | 1-to-1 chat conversations between users |
| `messages` | Individual chat messages with read tracking |
| `notifications` | All notification types (system, food, invites, joins) |
| `device_tokens` | Push notification tokens per device |
| `free_food_posts` | Food alerts with location, type, emoji, expiry |
| `free_food_subscriptions` | Users subscribed to food alerts |
| `achievements` | Achievement definitions with requirements |
| `user_achievements` | Unlocked achievements per user |
| `search_logs` | Search queries for trending analysis |
| `reports` | Content reports (events, users, messages, food posts) |

### Key Database Functions

| Function | Purpose |
|----------|---------|
| `reserve_event_with_capacity()` | Atomic RSVP with capacity enforcement using row locking |
| `purchase_ticket_with_inventory()` | Atomic ticket purchase with inventory check |
| `check_rate_limit()` | Configurable rate limiting per action per user |
| `check_and_unlock_achievements()` | Check and award new achievements |
| `get_friends_event_ids()` | Paginated list of events friends are attending |
| `get_attendee_count()` | Count attendees for an event |
| `get_friend_count()` | Count accepted friends for a user |
| `cleanup_expired_free_food()` | Deactivate expired food posts |

### Rate Limits

| Action | Limit | Window |
|--------|-------|--------|
| Create event | 10 | per hour |
| Friend request | 20 | per hour |
| Free food post | 5 | per hour |
| Send message | 30 | per minute |
| Report content | 5 | per hour |

### Triggers

| Event | Action |
|-------|--------|
| User joins event | Notify event creator |
| Reservation created | Notify user and creator |
| Event invitation sent | Notify invitee |
| Free food posted | Notify all subscribers |
| Free food post created | Auto-set 2hr expiry if none specified |

---

## Setup

### Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (Mac) or Android Emulator, or Expo Go on a physical device

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd JumboNow

# Install dependencies
npm install

# Start the development server
npx expo start
```

### Environment Variables

Create a `.env` file in the project root:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### Google Maps Setup

The campus map requires a Google Maps API key:

1. Create a project at https://console.cloud.google.com
2. Enable **Maps SDK for iOS** and **Maps SDK for Android**
3. Create an API key and restrict it to your bundle identifiers
4. Update `app.json`:

```json
"ios": {
  "config": {
    "googleMapsApiKey": "YOUR_KEY"
  }
},
"android": {
  "config": {
    "googleMaps": {
      "apiKey": "YOUR_KEY"
    }
  }
}
```

### Database Setup

Apply all Supabase migrations in order:

```bash
cd supabase
supabase db push
```

Or apply manually via the Supabase SQL editor — migrations are numbered `00001` through `00022` in `supabase/migrations/`.

---

## Running

```bash
# Start Expo dev server
npx expo start

# Run on iOS simulator
npx expo start --ios

# Run on Android emulator
npx expo start --android

# Run tests
npm test
```

---

## Theming

The app supports dark and light modes via `ThemeContext`. Theme preference is persisted in AsyncStorage under `@jumbo_now_theme`.

**Color palette** (Tufts brand):

- Primary: `#418FDE` (Tufts Blue)
- Light: `#6AADE4` (Tufts Light Blue)
- Deep: `#3579C6` (Tufts Deep Blue)
- Accent: `#A8B8C8` (Jumbo Silver)

All screens use `colors` from `useTheme()` and generate styles via `createStyles(colors)` for consistent theming.

---

## Architecture Decisions

- **No external state library** — React Context + service layer pattern keeps things simple. Each service module manages its own Supabase queries and caching.
- **In-memory caching** — Dining and shuttle data use time-based in-memory caches with configurable TTLs. Pull-to-refresh clears caches.
- **Row-Level Security** — Every Supabase table has RLS policies. Users can only read/write their own data. Public data (events, profiles) is readable by all authenticated users.
- **Rate limiting in the database** — A single `check_rate_limit` RPC function handles all rate limits, preventing abuse even if the client is modified.
- **Atomic capacity enforcement** — Event reservations use `SELECT ... FOR UPDATE` row locking to prevent overselling, even under concurrent requests.
- **Real-time subscriptions** — Supabase Realtime channels provide instant updates for messages, notifications, events, and free food without polling.
- **5-second fetch timeouts** — All external API calls (Nutrislice, Passio GO) use AbortController with a 5-second timeout to prevent hanging.

---

## Dependencies

### Runtime

| Package | Version | Purpose |
|---------|---------|---------|
| `react` | 19.1.0 | UI framework |
| `react-native` | 0.81.5 | Mobile runtime |
| `expo` | ~54.0.33 | Development platform |
| `@supabase/supabase-js` | ^2.95.3 | Backend client |
| `@react-navigation/native` | ^7.1.28 | Navigation |
| `@react-navigation/native-stack` | ^7.12.0 | Stack navigator |
| `@react-native-async-storage/async-storage` | 2.2.0 | Local persistence |
| `@react-native-community/datetimepicker` | ^8.6.0 | Date/time picker |
| `react-native-maps` | 1.20.1 | Google Maps |
| `react-native-safe-area-context` | ~5.6.0 | Safe area insets |
| `react-native-screens` | ~4.16.0 | Native screen containers |
| `react-native-svg` | 15.12.1 | SVG rendering (for icons) |
| `lucide-react-native` | ^0.563.0 | Icon library |
| `expo-linear-gradient` | ~15.0.8 | Gradient backgrounds |
| `expo-blur` | ~15.0.8 | iOS blur effects |
| `expo-location` | ~19.0.8 | GPS location |
| `expo-image-picker` | ~17.0.10 | Photo/camera picker |
| `expo-clipboard` | ~8.0.8 | Copy confirmation codes |
| `expo-sharing` | ^14.0.8 | Share events |
| `expo-notifications` | ^0.32.16 | Push notifications |
| `expo-device` | ^8.0.10 | Device info |
| `expo-constants` | ~18.0.13 | App constants |
| `expo-status-bar` | ~3.0.9 | Status bar control |

### Dev

| Package | Version | Purpose |
|---------|---------|---------|
| `jest` | ^29.7.0 | Test runner |
| `jest-expo` | ^54.0.17 | Expo test preset |
| `@testing-library/react-native` | ^13.3.3 | Component testing |
| `typescript` | ~5.9.2 | Type checking |
| `@types/react` | ~19.1.10 | React type definitions |

---

## Building for Production

```bash
# Install EAS CLI
npm install -g eas-cli

# Configure EAS (first time)
eas build:configure

# Build for iOS
eas build --platform ios --profile production

# Build for Android
eas build --platform android --profile production

# Submit to App Store
eas submit --platform ios

# Submit to Google Play
eas submit --platform android
```

Requirements:

- Apple Developer Account ($99/year) for iOS
- Google Play Developer Account ($25 one-time) for Android

---

## License

Private. All rights reserved.
