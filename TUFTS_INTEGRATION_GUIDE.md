# JumboNow - Tufts Integration & Implementation Guide

> Complete technical reference for every API, backend, and external service needed to make JumboNow fully functional.

---

## Table of Contents

1. [Current Architecture Overview](#1-current-architecture-overview)
2. [What's Already Working](#2-whats-already-working)
3. [Supabase Backend (Fully Integrated)](#3-supabase-backend-fully-integrated)
4. [Nutrislice Dining API (Fully Integrated)](#4-nutrislice-dining-api-fully-integrated)
5. [What Needs Integration](#5-what-needs-integration)
6. [Google Maps API](#6-google-maps-api)
7. [Push Notifications (Expo)](#7-push-notifications-expo)
8. [Transact Mobile Ordering](#8-transact-mobile-ordering)
9. [Apple Wallet / Google Wallet Pass](#9-apple-wallet--google-wallet-pass)
10. [Shuttle Tracking](#10-shuttle-tracking)
11. [Event Image Storage](#11-event-image-storage)
12. [Tufts SSO / Shibboleth (Optional)](#12-tufts-sso--shibboleth-optional)
13. [App Store Deployment](#13-app-store-deployment)
14. [Environment Variables Reference](#14-environment-variables-reference)
15. [Database Schema Reference](#15-database-schema-reference)
16. [API Endpoints Reference](#16-api-endpoints-reference)
17. [Cost Breakdown for Tufts](#17-cost-breakdown-for-tufts)
18. [Implementation Timeline](#18-implementation-timeline)

---

## 1. Current Architecture Overview

```
React Native (Expo SDK 54)
    |
    +-- Supabase (Auth + Postgres + Realtime + Storage + Edge Functions)
    |     URL: https://vdzvbbvgcubqlgnwjuxa.supabase.co
    |
    +-- Nutrislice API (Dining menus - no key required)
    |     URL: https://tufts.api.nutrislice.com/menu/api
    |
    +-- Transact Mobile Ordering (Deep link only)
    |     Scheme: transactmobileordering://
    |
    +-- Google Maps (NOT YET CONFIGURED - needs API key)
    |
    +-- Expo Push Notifications (PARTIALLY SET UP - needs completion)
```

**Tech Stack:**

- Frontend: React Native 0.81.5 / Expo SDK 54
- Backend: Supabase (PostgreSQL 15, Auth, Realtime, Storage, Edge Functions)
- Navigation: React Navigation 7 (Native Stack)
- Maps: react-native-maps 1.20.1
- Icons: lucide-react-native
- State: React Context (ThemeContext, AuthContext via services)

---

## 2. What's Already Working

| Feature | Status | Backend |
|---------|--------|---------|
| Email/password auth | WORKING | Supabase Auth |
| Email verification | WORKING | Supabase Auth |
| User profiles | WORKING | Supabase `profiles` table |
| Event CRUD | WORKING | Supabase `events` table |
| Event search (full-text) | WORKING | Supabase `search_vector` + `ilike` |
| RSVP / Tickets | WORKING | Supabase `event_reservations` |
| Event invitations | WORKING | Supabase `event_invitations` |
| Friends system | WORKING | Supabase `friendships` |
| Friend groups | WORKING | Supabase `friend_groups` |
| Direct messaging | WORKING | Supabase `messages` + Realtime |
| Notifications feed | WORKING | Supabase `notifications` + Realtime |
| Free food alerts | WORKING | Supabase `free_food_posts` + Realtime |
| Dining menus | WORKING | Nutrislice API (no key) |
| Dining hours/status | WORKING | Nutrislice API `operating_status` |
| Campus map (basic) | WORKING | Hardcoded 19 locations |
| Live shuttle tracking | WORKING | Passio GO API (System ID: 6670) |
| Shuttle route schedules | WORKING | Hardcoded 7 routes in MapScreen |
| Dining real logos | WORKING | Nutrislice API logo URLs |
| Organization logo upload | WORKING | Supabase Storage (event-images/org-logos/) |
| QR codes on tickets | WORKING | react-native-qrcode-svg |
| Campus resources (15 tiles) | WORKING | ProfileScreen + CampusResourcesScreen |
| SmartIcon (URL/emoji) | WORKING | Universal icon component |
| Achievements | WORKING | Supabase `achievements` + RPC |
| Event ratings | WORKING | Supabase `event_reservations.rating` |
| Content reporting | WORKING | Supabase `reports` |
| Rate limiting | WORKING | Supabase RPC `check_rate_limit` |
| Dark/Light theme | WORKING | AsyncStorage + ThemeContext |
| Deep linking | WORKING | `jumbonow://` scheme |
| Real-time updates | WORKING | Supabase Realtime (all tables) |
| Group chat | WORKING | Auto-created per friend group |
| Event sharing in chat | WORKING | DM + group chat event cards |
| Discover all users | WORKING | Browse non-friend users in Friends tab |
| Free food request flow | WORKING | Request/confirm/decline with codes |
| Free food image upload | WORKING | Supabase Storage (free-food-images/) |

---

## 3. Supabase Backend (Fully Integrated)

### Credentials

```
URL:      https://vdzvbbvgcubqlgnwjuxa.supabase.co
Anon Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZkenZiYnZnY3VicWxnbndqdXhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1NjkwNjksImV4cCI6MjA4NjE0NTA2OX0.RNwT3CFzhdAw-yDSWP_UYnKsR5N2iB9WLKIzdRZmcN4
```

### Tables (26 migrations applied)

| Table | Purpose | RLS |
|-------|---------|-----|
| `profiles` | User profiles (extends auth.users) | Yes |
| `events` | Events with all metadata | Yes |
| `event_attendees` | Who's attending (junction) | Yes |
| `event_reservations` | RSVPs + tickets + ratings | Yes |
| `event_invitations` | Friend/group invitations | Yes |
| `friendships` | Friend relationships (pending/accepted) | Yes |
| `friend_groups` | Named friend groups | Yes |
| `friend_group_members` | Group membership | Yes |
| `conversations` | 1-to-1 chat conversations | Yes |
| `messages` | Chat messages | Yes |
| `notifications` | All notification types | Yes |
| `device_tokens` | Push notification tokens | Yes |
| `free_food_posts` | Free food alerts | Yes |
| `free_food_subscriptions` | Food alert subscribers | Yes |
| `achievements` | Achievement definitions | Yes |
| `user_achievements` | Unlocked achievements | Yes |
| `search_logs` | Search queries for trending | Yes |
| `reports` | Content reports | Yes |
| `group_conversations` | Group chat conversations (auto-created per friend group) | Yes |
| `group_messages` | Group chat messages | Yes |
| `free_food_requests` | Free food request-to-accept flow with confirmation codes | Yes |

### Database Functions (RPCs)

| Function | Purpose |
|----------|---------|
| `get_attendee_count(event_uuid)` | Count event attendees |
| `get_friend_count(user_uuid)` | Count accepted friends |
| `get_mutual_friends_count(user_a, user_b)` | Mutual friend count |
| `get_friends_event_ids(limit, offset)` | Friends' event IDs |
| `check_rate_limit(user_id, action, max, window_min)` | Rate limit enforcement |
| `check_and_unlock_achievements(user_id)` | Achievement check + unlock |
| `reserve_event_with_capacity(...)` | Atomic RSVP with capacity lock |
| `purchase_ticket_with_inventory(...)` | Atomic ticket purchase |
| `cleanup_expired_free_food()` | Deactivate expired food posts |

### Triggers (Auto-fire)

| Trigger | On | Action |
|---------|-------|--------|
| `handle_event_join` | `event_attendees` INSERT | Notify event creator |
| `handle_reservation_created` | `event_reservations` INSERT | Notify user + creator |
| `handle_event_invitation` | `event_invitations` INSERT | Notify invitee |
| `notify_free_food_subscribers` | `free_food_posts` INSERT | Notify all subscribers |
| `trg_set_free_food_expiry` | `free_food_posts` INSERT | Default 2hr expiry |
| `profiles_updated_at` | `profiles` UPDATE | Timestamp auto-update |
| `events_updated_at` | `events` UPDATE | Timestamp auto-update |
| `notify_free_food_requested` | `free_food_requests` INSERT | Notify poster of new request |
| `trg_auto_create_group_convo` | `friend_groups` INSERT | Auto-create group chat for new friend group |
| `trg_cleanup_free_food_notifications` | `free_food_posts` UPDATE (deactivation) | Clean up related notifications |

### Rate Limits (Enforced via RPC)

| Action | Limit | Window |
|--------|-------|--------|
| `create_event` | 10 | 1 hour |
| `friend_request` | 20 | 1 hour |
| `free_food_post` | 5 | 1 hour |
| `send_message` | 30 | 1 minute |
| `report` | 5 | 1 hour |

---

## 4. Nutrislice Dining API (Fully Integrated)

**No API key required. Free, read-only, public JSON API.**

### Base URL

```
https://tufts.api.nutrislice.com/menu/api
```

### Endpoints

#### List all dining locations

```
GET /schools/?format=json
```
Returns array of school objects with:

- `name`, `slug`, `id`
- `operating_status`: "open" | "closed" | "closing-soon"
- `active_menu_types`: [{ slug: "breakfast", name: "Breakfast" }, ...]
- Hours: `mon_enabled`, `mon_start` ("11:00:00"), `mon_end` ("22:00:00"), etc.
- `latitude`, `longitude`

#### Get menu for a specific meal type and date

```
GET /weeks/school/{slug}/menu-type/{mealTypeSlug}/{year}/{month}/{day}/
```
- `slug`: e.g., `dewick-dining`, `carmichael-dining-hall`
- `mealTypeSlug`: `breakfast`, `lunch`, `dinner`, `daily`, `late-night`
- Returns weekly data; extract matching day by `date` field

Response structure per day:

```json
{
  "date": "2026-02-10",
  "menu_info": {
    "12345": {
      "position": 0,
      "section_options": { "display_name": "Main Line" }
    }
  },
  "menu_items": [
    {
      "id": 67890,
      "menu_id": 12345,
      "food": {
        "name": "Grilled Chicken",
        "rounded_nutrition_info": {
          "calories": 250,
          "g_protein": 30,
          "g_total_carb": 5,
          "g_total_fat": 12,
          "g_dietary_fiber": 1,
          "mg_sodium": 480
        },
        "ingredients": "chicken breast, olive oil, ...",
        "icons": {
          "food_icons": [
            { "slug": "gluten-free", "synced_name": "Gluten Free", "enabled": true }
          ]
        }
      }
    }
  ]
}
```

### Known Dining Locations (11 active)

| Slug | Display Name | Type | Has Mobile Ordering |
|------|-------------|------|---------------------|
| `dewick-dining` | Dewick | Dining Hall | No (Swipe In) |
| `carmichael-dining-hall` | Carm | Dining Hall | No (Swipe In) |
| `hodgdon-food-on-the-run` | Hodgdon | Grab & Go | Yes (Transact) |
| `hotung-cafe` | Hotung | Cafe | Yes (Transact) |
| `commons-marketplace` | Commons | Cafe | Yes (Transact) |
| `kindlevan-cafe` | Kindlevan | Cafe | No (Walk In) |
| `pax-et-lox-glatt-kosher-deli` | Pax et Lox | Grab & Go | No (Walk In) |
| `tower-cafe` | Tower Cafe | Cafe | No (Walk In) |
| `mugar-cafe` | Mugar Cafe | Cafe | No (Walk In) |
| `late-night-at-commons` | Late Night | Cafe | Yes (Transact) |
| `smfa` | SMFA | Cafe | No (Walk In) |

### Caching Strategy (Already Implemented)

- Schools list: 1 hour in-memory
- Menu per location/meal/date: 30 minutes in-memory
- Fetch timeout: 5 seconds via AbortController
- Pull-to-refresh clears all caches

---

## 5. What Needs Integration

| Feature | Effort | Priority | Dependency |
|---------|--------|----------|------------|
| Google Maps API key | 1 hour | HIGH | Google Cloud Console |
| Push notifications | 2-3 days | HIGH | Expo + Supabase Edge Function |
| Event image upload | 1 day | MEDIUM | Supabase Storage (bucket exists) |
| Apple/Google Wallet pass | 2-3 days | LOW | Edge Function + Apple Dev Account |
| ~~Shuttle tracking~~ | ~~DONE~~ | ~~N/A~~ | Fully integrated via Passio GO (System ID: 6670) |
| Tufts SSO (Shibboleth) | 1-2 weeks | OPTIONAL | Tufts IT approval |
| Real busyness data | 1 week | OPTIONAL | SafeGraph/Placer.ai or manual |

---

## 6. Google Maps API

### What You Need

A Google Cloud Platform account with the **Maps SDK for iOS** and **Maps SDK for Android** enabled.

### Steps

1. Go to https://console.cloud.google.com
2. Create a project (or use existing)
3. Enable these APIs:
   - **Maps SDK for Android**
   - **Maps SDK for iOS**
4. Create an API key under Credentials
5. Restrict the key:
   - iOS: restrict to bundle ID `com.jumbonow.app`
   - Android: restrict to package `com.jumbonow.app` + SHA-1 fingerprint
6. Replace in `app.json`:

```json
"ios": {
  "googleMapsApiKey": "AIzaSy..."
},
"android": {
  "googleMaps": {
    "apiKey": "AIzaSy..."
  }
}
```

### Cost

- Free tier: 28,000 map loads/month ($200 credit)
- For a campus app this is more than enough

### Time to Implement: 1 hour

---

## 7. Push Notifications (Expo)

### Current State

- `device_tokens` table exists in Supabase
- `expo-notifications` is installed (v0.32.16)
- `expo-device` is installed
- Notification triggers exist (new messages, event joins, food alerts)
- **Missing**: Token registration code in app + Edge Function to send pushes

### What You Need from Tufts: Nothing (uses Expo Push Service)

### Implementation Steps

#### Step 1: Register push tokens in app (client-side)

Add to `App.js` or a new `usePushNotifications` hook:

```javascript
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from './src/config/supabase';

async function registerForPushNotifications() {
  if (!Device.isDevice) return null;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return null;

  const token = (await Notifications.getExpoPushTokenAsync({
    projectId: 'YOUR_EXPO_PROJECT_ID', // from app.json extra.eas.projectId
  })).data;

  // Save to Supabase
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabase.from('device_tokens').upsert({
      user_id: user.id,
      token: token,
      platform: Platform.OS,
    }, { onConflict: 'user_id,token' });
  }

  return token;
}
```

#### Step 2: Create Supabase Edge Function to send pushes

Create `supabase/functions/send-push/index.ts`:

```typescript
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const { user_id, title, body, data } = await req.json();

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Get user's device tokens
  const { data: tokens } = await supabase
    .from('device_tokens')
    .select('token')
    .eq('user_id', user_id);

  if (!tokens?.length) return new Response('No tokens', { status: 200 });

  // Send via Expo Push API
  const messages = tokens.map(t => ({
    to: t.token,
    sound: 'default',
    title,
    body,
    data,
  }));

  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(messages),
  });

  return new Response(JSON.stringify(await res.json()), { status: 200 });
});
```

#### Step 3: Wire notification triggers to Edge Function

Update existing Supabase triggers to call the Edge Function, or use a Database Webhook:

```sql
-- In Supabase Dashboard > Database > Webhooks
-- Create webhook on notifications INSERT
-- URL: https://vdzvbbvgcubqlgnwjuxa.supabase.co/functions/v1/send-push
-- Headers: Authorization: Bearer <SERVICE_ROLE_KEY>
```

#### Step 4: Handle received notifications in app

```javascript
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Handle tap on notification
Notifications.addNotificationResponseReceivedListener(response => {
  const data = response.notification.request.content.data;
  // Navigate based on data.type: 'event', 'chat', 'free_food', etc.
});
```

### Expo Push API (Free)

```
POST https://exp.host/--/api/v2/push/send
Content-Type: application/json

{
  "to": "ExponentPushToken[xxxx]",
  "title": "New Message",
  "body": "Alex sent you a message",
  "data": { "type": "chat", "conversationId": "abc123" }
}
```

### Cost: Free (Expo Push Service has no charge)

### Time to Implement: 2-3 days

---

## 8. Transact Mobile Ordering

### Current State: WORKING (deep link only)

The app already deep-links to the Transact Mobile Ordering app for locations that support it (Hodgdon, Hotung, Commons, Late Night).

### How It Works

```javascript
// Deep link scheme
transactmobileordering://

// Fallback to app store
iOS:     https://apps.apple.com/us/app/transact-mobile-ordering/id1495670313
Android: https://play.google.com/store/apps/details?id=com.compass.transact
```

### What You Need from Tufts: Nothing

- Transact is already installed and configured for Tufts
- Students use their JumboCash/meal plan through the Transact app
- JumboNow simply redirects to it

### No API integration needed. No cost.

---

## 9. Apple Wallet / Google Wallet Pass

### Current State

- `getWalletPassUrl()` method exists in `tickets.service.js`
- References Edge Function `wallet-pass` (not yet created)
- Confirmation codes are generated (8-char alphanumeric)

### What You Need

1. **Apple Developer Account** ($99/year) for Apple Wallet passes
2. **Pass Type ID** certificate from Apple Developer portal
3. **Google Wallet API** access (free)

### Implementation

#### Apple Wallet Pass (Edge Function)

```typescript
// supabase/functions/wallet-pass/index.ts
// Uses passkit-generator or similar library
// Generates .pkpass file with:
// - Event name, date, location
// - Confirmation code (barcode)
// - JumboNow branding

// Required Apple certificates:
// - Pass Type ID certificate (.p12)
// - WWDR intermediate certificate
// - Stored as Supabase Edge Function secrets
```

#### Google Wallet Pass

```
POST https://walletobjects.googleapis.com/walletobjects/v1/eventTicketObject
Authorization: Bearer <service_account_token>
```

### Cost

- Apple Developer Account: $99/year
- Google Wallet API: Free

### Time to Implement: 2-3 days

---

## 10. Shuttle Tracking (Fully Integrated)

### Current State: WORKING

Live shuttle tracking is fully integrated into MapScreen and ShuttleScreen using the **Passio GO** public API (System ID: 6670).

### What's Working

- **Real-time vehicle positions** polled every 10 seconds via Passio GO API
- **7 shuttle routes** with hardcoded schedules and color-coded map overlays
- **Animated shuttle markers** showing live bus positions on the campus map
- **ShuttleScreen** with route list, schedules, and route details
- **MapScreen integration** with shuttle toggle to show/hide live shuttles

### Passio GO API (No Key Required)

```
Base URL: https://passio3.com/passioTransit/gtfs/realtime/vehiclePositions.json?
System ID: 6670

# Get real-time vehicle positions for Tufts
GET https://passio3.com/passioTransit/gtfs/realtime/vehiclePositions.json?sysid=6670
```

### 7 Shuttle Routes Supported

| Route | Service | Hours |
|-------|---------|-------|
| Joey | Medford Campus Loop | Mon-Fri 7AM-7PM |
| Campus Connector | Medford ↔ SMFA | Mon-Fri 8AM-6PM |
| Davis Square | Campus ↔ Davis Sq | Mon-Fri 7AM-11PM |
| Boston Avenue | Boston Ave Loop | Mon-Fri 7:30AM-6PM |
| Late Night | Extended Campus | Thu-Sat 9PM-2AM |
| Weekend | Weekend Service | Sat-Sun 10AM-6PM |
| Health Sciences | Campus ↔ Medical | Mon-Fri 7AM-5PM |

### Cost: Free (public GTFS-RT feed, no API key or vendor agreement needed)

### No further integration needed.

---

## 11. Event Image Storage

### Current State

- Supabase Storage bucket `event-images` already created (migration 00015)
- `image_url` column exists on `events` table
- No upload UI or service code exists yet

### Implementation

```javascript
// In events.service.js or a new image.service.js

import { supabase } from '../config/supabase';
import * as ImagePicker from 'expo-image-picker';

async function uploadEventImage(eventId, imageUri) {
  const response = await fetch(imageUri);
  const blob = await response.blob();
  const fileName = `${eventId}/${Date.now()}.jpg`;

  const { data, error } = await supabase.storage
    .from('event-images')
    .upload(fileName, blob, {
      contentType: 'image/jpeg',
      upsert: true,
    });

  if (error) throw error;

  const { data: { publicUrl } } = supabase.storage
    .from('event-images')
    .getPublicUrl(fileName);

  // Update event with image URL
  await supabase
    .from('events')
    .update({ image_url: publicUrl })
    .eq('id', eventId);

  return publicUrl;
}
```

### Storage Policy Needed
```sql
-- Allow authenticated users to upload to event-images bucket
CREATE POLICY "Users can upload event images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'event-images');

-- Allow public read access
CREATE POLICY "Public can view event images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'event-images');
```

### Cost: Supabase free tier includes 1GB storage

### Time to Implement: 1 day

---

## 12. Tufts SSO / Shibboleth (Optional)

### Current State
- App uses email/password auth via Supabase
- No Tufts SSO integration

### What Tufts Uses
Tufts uses **Shibboleth** (SAML 2.0) for single sign-on.
- Identity Provider: `https://shib-idp.tufts.edu/idp/shibboleth`
- Students log in with their Tufts UTLN (username) and password

### Integration Approach
Supabase supports SAML SSO on the **Pro plan** ($25/month):

1. Contact **Tufts IT / Identity Management** to register JumboNow as a Service Provider
2. Provide them:
   - ACS URL: `https://vdzvbbvgcubqlgnwjuxa.supabase.co/auth/v1/sso/saml/acs`
   - Entity ID: `https://vdzvbbvgcubqlgnwjuxa.supabase.co/auth/v1/sso/saml/metadata`
3. They provide:
   - IdP metadata XML
   - Attribute mapping (UTLN, email, display name)
4. Configure in Supabase Dashboard > Authentication > SSO Providers

### In the App
```javascript
// Trigger SSO login
const { data, error } = await supabase.auth.signInWithSSO({
  domain: 'tufts.edu',
});
// Opens browser for Tufts Shibboleth login
// Redirects back to app via deep link
```

### What You Need from Tufts
- Approval from Tufts IT to register as a SAML Service Provider
- Contact: Tufts Technology Services (TTS) - https://it.tufts.edu
- Expect 2-4 weeks for approval process

### Cost
- Supabase Pro plan: $25/month (required for SAML SSO)
- Tufts side: Free (they just configure the IdP)

### Time to Implement: 1-2 weeks (mostly waiting on Tufts IT approval)

---

## 13. App Store Deployment

### What You Need

#### Apple App Store
1. **Apple Developer Account**: $99/year
2. **EAS Build** (Expo Application Services): Free tier available
3. **App Store Connect** listing with screenshots, description, privacy policy
4. **Privacy policy URL** (required) - host on your domain or GitHub Pages

```bash
# Build for iOS
npx eas build --platform ios --profile production

# Submit to App Store
npx eas submit --platform ios
```

#### Google Play Store
1. **Google Play Developer Account**: $25 one-time
2. **EAS Build** for Android

```bash
# Build for Android
npx eas build --platform android --profile production

# Submit to Google Play
npx eas submit --platform android
```

#### EAS Configuration
Create `eas.json`:
```json
{
  "cli": { "version": ">= 3.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {}
  },
  "submit": {
    "production": {}
  }
}
```

### Cost
- Apple Developer: $99/year
- Google Play Developer: $25 one-time
- EAS Build: Free (30 builds/month), $99/month for priority

### Time to Deploy: 2-3 days (build + review)
- Apple review: 1-3 days
- Google review: 1-2 days

---

## 14. Environment Variables Reference

### Currently Set
```env
EXPO_PUBLIC_SUPABASE_URL=https://vdzvbbvgcubqlgnwjuxa.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
```

### Need to Add
```env
# Google Maps (required for map functionality)
GOOGLE_MAPS_API_KEY=AIzaSy...

# Expo Push Notifications (get from expo.dev project settings)
EXPO_PROJECT_ID=your-expo-project-id

# Supabase Service Role Key (for Edge Functions only, NEVER in client)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJI...  # Only in Supabase Edge Function secrets

# Apple Wallet (optional, for wallet passes)
APPLE_PASS_TYPE_ID=pass.com.jumbonow.ticket
APPLE_TEAM_ID=XXXXXXXXXX
```

### AsyncStorage Keys (Client-side persistence)
| Key | Purpose |
|-----|---------|
| `jumbonow_onboarding_done` | Track onboarding completion |
| `jumbonow_home_filters` | Persist home screen filters |
| `jumbonow_discover_filters` | Persist discover filters |
| `@jumbo_now_theme` | Theme preference (dark/light) |

---

## 15. Database Schema Reference

### Core Tables

```sql
-- profiles (extends auth.users)
id              uuid PRIMARY KEY REFERENCES auth.users
username        text UNIQUE
display_name    text
email           text
bio             text
graduation_year text
avatar_url      text
avatar_color    text DEFAULT '#22D3EE'
is_verified     boolean DEFAULT false
major           text
campus          text
account_type    text DEFAULT 'student'  -- student | organizer | admin
vibe_score      integer DEFAULT 50
events_attended integer DEFAULT 0
activities_created integer DEFAULT 0
created_at      timestamptz
updated_at      timestamptz  -- auto-updated via trigger

-- events
id              uuid PRIMARY KEY
title           text NOT NULL
subtitle        text
description     text
icon            text
color           text
gradient_colors text[]
category        text
location        text
start_time      timestamptz NOT NULL
end_time        timestamptz
max_capacity    integer
tags            text[]
energy          text
vibe            text
created_by      uuid REFERENCES profiles
event_type      text  -- free | paid | donation
ticket_price    numeric DEFAULT 0
is_free         boolean GENERATED (ticket_price = 0 OR ticket_price IS NULL)
ticket_types    jsonb
is_featured     boolean DEFAULT false
organizer_name  text
organizer_icon  text
image_url       text
visibility      text

-- event_reservations
id                uuid PRIMARY KEY
event_id          uuid REFERENCES events
user_id           uuid REFERENCES profiles
status            text DEFAULT 'confirmed'  -- confirmed | waitlisted | cancelled
reservation_type  text  -- free_rsvp | ticket_purchase
ticket_type       text
price_paid        numeric DEFAULT 0
confirmation_code text  -- 8-char alphanumeric
rating            integer CHECK (1-5)
feedback          text
rated_at          timestamptz
purchased_at      timestamptz
UNIQUE (event_id, user_id)

-- friendships
id              uuid PRIMARY KEY
requester_id    uuid REFERENCES profiles
addressee_id    uuid REFERENCES profiles
status          text DEFAULT 'pending'  -- pending | accepted | declined
created_at      timestamptz
UNIQUE (requester_id, addressee_id)

-- messages
id              uuid PRIMARY KEY
conversation_id uuid REFERENCES conversations
sender_id       uuid REFERENCES profiles
text            text NOT NULL
read            boolean DEFAULT false
created_at      timestamptz

-- free_food_posts
id              uuid PRIMARY KEY
posted_by       uuid REFERENCES profiles
title           text NOT NULL
description     text
food_type       text  -- pizza | sandwiches | snacks | drinks | baked_goods | fruit | full_meal | other
location_name   text
latitude        double precision
longitude       double precision
emoji           text
is_active       boolean DEFAULT true
expires_at      timestamptz  -- auto-set to 2hr if null
created_at      timestamptz

-- notifications
id              uuid PRIMARY KEY
user_id         uuid REFERENCES profiles
type            text  -- system | free_food | event_invitation | event_join | new_reservation
icon            text
title           text
body            text
category        text
color           text
read            boolean DEFAULT false
created_at      timestamptz

-- group_conversations (auto-created per friend group)
id              uuid PRIMARY KEY
group_id        uuid REFERENCES friend_groups
name            text
created_at      timestamptz

-- group_messages
id              uuid PRIMARY KEY
conversation_id uuid REFERENCES group_conversations
sender_id       uuid REFERENCES profiles
text            text NOT NULL
message_type    text DEFAULT 'text'  -- text | event_share
event_id        uuid REFERENCES events  -- for event_share messages
created_at      timestamptz

-- free_food_requests
id              uuid PRIMARY KEY
post_id         uuid REFERENCES free_food_posts
requester_id    uuid REFERENCES profiles
status          text DEFAULT 'pending'  -- pending | accepted | declined
confirmation_code text  -- 6-digit code
created_at      timestamptz
responded_at    timestamptz
UNIQUE (post_id, requester_id)
```

---

## 16. API Endpoints Reference

### Supabase REST API

All tables accessible via PostgREST at:
```
https://vdzvbbvgcubqlgnwjuxa.supabase.co/rest/v1/{table}
```
Authenticated with `apikey` header (anon key) + `Authorization: Bearer <access_token>`.

### Supabase Auth API

```
POST /auth/v1/signup          -- Register
POST /auth/v1/token?grant_type=password  -- Login
POST /auth/v1/logout          -- Logout
GET  /auth/v1/user            -- Get current user
PUT  /auth/v1/user            -- Update user metadata
POST /auth/v1/resend          -- Resend confirmation
```

### Supabase Realtime

```
wss://vdzvbbvgcubqlgnwjuxa.supabase.co/realtime/v1/websocket
```
Channels subscribed to: events, event_attendees, event_reservations, friendships, conversations, messages, notifications, free_food_posts, group_conversations, group_messages, free_food_requests.

### Supabase Storage

```
POST   /storage/v1/object/event-images/{path}       -- Upload event/org images
GET    /storage/v1/object/public/event-images/{path} -- Download event/org images
DELETE /storage/v1/object/event-images/{path}        -- Delete event/org images

POST   /storage/v1/object/free-food-images/{path}       -- Upload free food photos
GET    /storage/v1/object/public/free-food-images/{path} -- Download free food photos
DELETE /storage/v1/object/free-food-images/{path}        -- Delete free food photos
```

### Nutrislice (Dining)

```
GET https://tufts.api.nutrislice.com/menu/api/schools/?format=json
GET https://tufts.api.nutrislice.com/menu/api/weeks/school/{slug}/menu-type/{meal}/{year}/{month}/{day}/
```

### Expo Push API

```
POST https://exp.host/--/api/v2/push/send
```

---

## 17. Cost Breakdown for Tufts

> What it would cost the university to run and maintain JumboNow in production.

### One-Time Costs

| Item | Cost | Notes |
|------|------|-------|
| Apple Developer Account | $99 | Required for iOS App Store. Annual renewal (see below). |
| Google Play Developer Account | $25 | One-time fee for Android Play Store listing. |
| **Total One-Time** | **$124** | |

### Monthly Recurring Costs

#### Minimum Viable (Free Tier)

Running on free tiers for a small launch (under ~500 active users):

| Service | Monthly Cost | What You Get |
|---------|-------------|--------------|
| Supabase (Free) | $0 | 500MB database, 1GB storage, 2GB bandwidth, 500K Edge Function invocations, 50K monthly active users |
| Google Maps Platform | $0 | $200/month free credit = ~28,000 map loads/month. Enough for a campus app. |
| Expo / EAS Build (Free) | $0 | 30 builds/month, Expo Push Notifications (unlimited, free) |
| Nutrislice Dining API | $0 | Public API, no key required, no usage limits known |
| Passio GO Shuttle Data | $0 | Public GTFS-RT feed (System ID: 6670) |
| Transact Mobile Ordering | $0 | Deep link only, no API contract needed |
| **Total Monthly (Free Tier)** | **$0/month** | Suitable for launch and early growth |

#### Recommended Production (Scaled)

For a full campus deployment (1,000-5,000+ active users):

| Service | Monthly Cost | What You Get |
|---------|-------------|--------------|
| Supabase Pro | $25/month | 8GB database, 100GB storage, 250GB bandwidth, unlimited API requests, SAML SSO support (required for Tufts Shibboleth), daily backups, email support |
| Google Maps Platform | $0 | Still within free $200/month credit. Would only exceed at ~28K+ map loads/month (unlikely for a single campus). |
| Expo / EAS Build (Free) | $0 | 30 builds/month is sufficient. Upgrade to $99/month only if faster build queues are needed. |
| Nutrislice Dining API | $0 | No cost |
| Passio GO Shuttle Data | $0 | No cost |
| Custom domain (optional) | $12/year (~$1/month) | For jumbonow.app or similar (privacy policy, marketing page) |
| **Total Monthly (Production)** | **$25-26/month** | Recommended for full campus rollout |

#### High Scale (10,000+ users, optional upgrades)

| Service | Monthly Cost | Notes |
|---------|-------------|-------|
| Supabase Pro | $25/month | Compute add-ons available if needed ($5-40/month for more CPU/RAM) |
| EAS Build Priority (optional) | $99/month | Only needed if building frequently (CI/CD pipeline) |
| Sentry Error Monitoring (optional) | $0 (free tier) | 5K errors/month free. Developer plan $26/month for more. |
| **Total Monthly (High Scale)** | **$25-150/month** | Upper bound only if all optional services are added |

### Annual Recurring Costs

| Item | Annual Cost | Notes |
|------|------------|-------|
| Apple Developer Account renewal | $99/year | Required to keep iOS app on App Store |
| Supabase Pro (if using SSO) | $300/year | $25/month x 12 |
| Google Play (no renewal) | $0 | One-time fee already paid |
| Google Maps Platform | $0 | Free credit covers campus usage |
| **Total Annual (Production)** | **$399/year** | With SSO. Without SSO: $99/year (Apple only). |

### Cost Comparison

To put this in perspective for the university:

| Solution | Estimated Annual Cost |
|----------|--------------------|
| **JumboNow (self-hosted on Supabase free tier)** | **$99/year** (Apple Developer only) |
| **JumboNow (production with SSO)** | **$399/year** |
| Commercial campus app (Ready Education, Modo Labs) | $25,000-75,000/year |
| Custom development by vendor | $50,000-200,000 upfront + $10,000-30,000/year maintenance |
| Student government app (typical) | $2,000-5,000/year (limited features) |

JumboNow delivers a feature-rich campus app at a fraction of the cost of commercial alternatives.

### What Tufts Would NOT Pay For

These are already built and included at no additional cost:

- Event management system (CRUD, search, RSVP, ticketing, invitations)
- Social features (friends, groups, messaging, notifications)
- Free food alert system with real-time updates
- Dining menus with nutrition data (via Nutrislice)
- Live shuttle tracking (via Passio GO)
- Campus map with 19 locations and walking directions
- QR code tickets with confirmation codes
- Achievement and gamification system
- Dark/light theme
- Content moderation and reporting
- Rate limiting and security measures
- 15 campus resource quick-links

### Optional Costs (Only If Desired)

| Feature | Cost | Notes |
|---------|------|-------|
| Apple Wallet passes | Included in $99/year Apple Developer Account | No additional cost beyond the developer account |
| Google Wallet passes | $0 | Google Wallet API is free |
| Tufts SSO (Shibboleth) | $25/month (Supabase Pro) | Requires Tufts IT approval (free on their side) |
| Custom domain | $10-15/year | For privacy policy page and marketing site |
| EAS priority builds | $99/month | Only for frequent CI/CD builds, not needed for most teams |

### Summary

| Scenario | Year 1 Total | Ongoing Annual |
|----------|-------------|----------------|
| **Bare Minimum** (free tiers, no SSO) | $124 | $99/year |
| **Recommended Production** (with SSO) | $424 | $399/year |
| **All Optional Features** | $424-$1,612 | $399-$1,587/year |

The recommended production setup costs Tufts approximately **$25-35/month** ($399/year including the Apple Developer Account), which is less than a single student meal plan for the entire year.

---

## 18. Implementation Timeline

### Already Complete (0 days remaining)

- Supabase backend (all 26 migrations)
- Auth flow (register, login, email verification, onboarding)
- Events system (CRUD, search, RSVP, tickets, invitations, ratings)
- Social features (friends, groups, messaging, notifications)
- Group chat (auto-created per friend group, event sharing)
- Discover all users (browse non-friend users)
- Free food alerts with real-time updates
- Free food request-to-accept flow with confirmation codes
- Free food image upload to Supabase Storage
- Dining menus via Nutrislice API
- Campus map with 19 locations
- Live shuttle tracking via Passio GO (7 routes, real-time vehicle positions)
- Achievements and vibe score
- Dark/light theme
- Deep linking
- Content reporting and rate limiting

### Phase 1: Critical (3-4 days)

| Task | Time | Dependency |
|------|------|------------|
| Add Google Maps API key to `app.json` | 1 hour | Google Cloud account |
| Implement push notification token registration | 4 hours | Expo project ID |
| Create `send-push` Edge Function | 4 hours | Supabase service role key |
| Wire push notifications to existing triggers | 4 hours | Edge Function deployed |
| Event image upload in CreateEventScreen | 6 hours | Supabase Storage policy |
| Test all features end-to-end | 4 hours | All above complete |

### Phase 2: Nice-to-Have (3 days)

| Task | Time | Dependency |
|------|------|------------|
| Apple Wallet pass generation | 2 days | Apple Developer Account |
| Google Wallet pass generation | 1 day | Google Cloud project |
| ~~Shuttle tracking integration~~ | ~~DONE~~ | Already integrated via Passio GO |

### Phase 3: Polish (3-5 days)

| Task | Time | Dependency |
|------|------|------------|
| Tufts SSO (Shibboleth) | 1-2 weeks | Tufts IT approval |
| Real-time busyness data | 1 week | Data source (SafeGraph, etc.) |
| App Store submission (iOS + Android) | 2-3 days | Developer accounts |

### Total to Fully Functional App

| Milestone | Cumulative Time |
|-----------|----------------|
| Core features working (current state) | Done |
| + Shuttle tracking (Passio GO) | Done |
| + Group chat, discover users, free food request flow | Done |
| + Maps API key + Push + Image Upload | +3-4 days |
| + Wallet Passes | +3 more days |
| + SSO + App Store | +2 more weeks |
| **Everything fully integrated** | **~3 weeks total** |

---

## Quick Start Checklist

- [x] Supabase backend with 26 migrations, RLS on all tables
- [x] Auth flow (register, login, email verification, onboarding)
- [x] Events system (CRUD, search, RSVP, tickets, invitations, ratings)
- [x] Social features (friends, groups, DMs, group chat, notifications)
- [x] Discover all users (browse non-friend users in Friends tab)
- [x] Free food alerts with request-to-accept flow and image upload
- [x] Dining menus via Nutrislice API (11 locations, nutrition data)
- [x] Live shuttle tracking via Passio GO (7 routes, real-time positions)
- [x] Campus map with 19 locations
- [x] Achievements, vibe score, content reporting, rate limiting
- [ ] Get Google Maps API key and add to `app.json`
- [ ] Set up Expo project on expo.dev for push notification project ID
- [ ] Deploy `send-push` Supabase Edge Function
- [ ] Add push token registration to app startup
- [ ] Add Storage policy for `event-images` bucket
- [ ] Add image picker to CreateEventScreen
- [ ] Test on physical iOS and Android devices
- [ ] Create Apple Developer Account ($99/year)
- [ ] Create Google Play Developer Account ($25)
- [ ] Build with EAS and submit to stores
- [ ] (Optional) Contact Tufts IT for Shibboleth SSO registration
