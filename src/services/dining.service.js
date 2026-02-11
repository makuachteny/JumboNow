const BASE_URL = 'https://tufts.api.nutrislice.com/menu/api';
const FETCH_TIMEOUT = 5000;

// In-memory caches
let schoolsCache = null;
let schoolsCacheTime = 0;
const SCHOOLS_TTL = 60 * 60 * 1000; // 1 hour

const menuCache = new Map();
const MENU_TTL = 30 * 60 * 1000; // 30 minutes

function timeoutFetch(url, ms = FETCH_TIMEOUT) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

export const diningService = {
  async getSchools() {
    if (schoolsCache && Date.now() - schoolsCacheTime < SCHOOLS_TTL) {
      return schoolsCache;
    }
    const res = await timeoutFetch(`${BASE_URL}/schools/?format=json`);
    if (!res.ok) throw new Error('Failed to fetch dining locations');
    const data = await res.json();
    schoolsCache = data;
    schoolsCacheTime = Date.now();
    return data;
  },

  /**
   * Fetch menu for a specific meal type slug (breakfast, lunch, dinner, daily, late-night).
   * The API returns a week; we extract the matching day.
   */
  async getMenuForDay(slug, mealTypeSlug = 'lunch', date = new Date()) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const cacheKey = `${slug}:${mealTypeSlug}:${year}-${month}-${day}`;

    const cached = menuCache.get(cacheKey);
    if (cached && Date.now() - cached.time < MENU_TTL) {
      return cached.data;
    }

    const url = `${BASE_URL}/weeks/school/${slug}/menu-type/${mealTypeSlug}/${year}/${month}/${day}/`;
    const res = await timeoutFetch(url);
    if (!res.ok) throw new Error('Failed to fetch menu');
    const weekData = await res.json();

    // Extract the matching day from the week response
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayData = weekData.days?.find((d) => d.date === dateStr) || weekData.days?.[0];

    if (!dayData) {
      const result = { stations: [] };
      menuCache.set(cacheKey, { data: result, time: Date.now() });
      return result;
    }

    // Build station name lookup from day-level menu_info
    // menu_info is keyed by menu_id: { position, section_options: { display_name } }
    const menuInfo = dayData.menu_info || {};
    const stationMap = {};
    Object.entries(menuInfo).forEach(([menuId, info]) => {
      stationMap[menuId] = {
        name: info.section_options?.display_name || 'Other',
        position: info.position ?? 999,
      };
    });

    // Group food items by station using menu_id
    const stationItems = new Map();
    const items = dayData.menu_items || [];

    items.forEach((item) => {
      if (!item.food) return;

      const menuId = String(item.menu_id || '');
      const stationInfo = stationMap[menuId] || { name: 'Other', position: 999 };
      const stationName = stationInfo.name;

      if (!stationItems.has(stationName)) {
        stationItems.set(stationName, { items: [], position: stationInfo.position });
      }

      const food = item.food;
      const ni = food.rounded_nutrition_info || {};

      // Icons: { food_icons: [...], myplate_icons: [...] }
      const foodIcons = food.icons?.food_icons || [];
      const icons = foodIcons
        .filter((ic) => ic.enabled !== false)
        .map((ic) => ({ label: ic.synced_name || ic.name || '', slug: ic.slug || '' }));

      stationItems.get(stationName).items.push({
        id: item.id || `${food.name}-${Math.random()}`,
        name: food.name || 'Unknown Item',
        calories: ni.calories ?? null,
        protein: ni.g_protein ?? null,
        carbs: ni.g_total_carb ?? null,
        fat: ni.g_total_fat ?? null,
        fiber: ni.g_dietary_fiber ?? null,
        sodium: ni.mg_sodium ?? null,
        ingredients: food.ingredients || null,
        icons,
      });
    });

    // Convert to sorted array of sections
    const stations = Array.from(stationItems.entries())
      .sort((a, b) => a[1].position - b[1].position)
      .map(([title, { items: data }]) => ({ title, data }));

    const result = { stations };
    menuCache.set(cacheKey, { data: result, time: Date.now() });
    return result;
  },

  /**
   * Fetch all available meal types for a location, returning combined station data per meal.
   */
  async getAllMealsForDay(slug, activeMenuTypes = [], date = new Date()) {
    const meals = [];
    for (const mt of activeMenuTypes) {
      try {
        const data = await this.getMenuForDay(slug, mt.slug, date);
        if (data.stations.length > 0) {
          meals.push({ key: mt.slug, name: mt.name, stations: data.stations });
        }
      } catch (_) {
        // skip failed meal types
      }
    }
    return meals;
  },

  getCurrentMealPeriod() {
    const hour = new Date().getHours();
    if (hour >= 7 && hour < 11) return 'breakfast';
    if (hour >= 11 && hour < 16) return 'lunch';
    if (hour >= 16 && hour < 21) return 'dinner';
    return 'late-night';
  },

  getMealPeriodLabel(key) {
    const labels = {
      breakfast: 'Breakfast',
      lunch: 'Lunch',
      dinner: 'Dinner',
      'late-night': 'Late Night',
      daily: 'Daily',
      brunch: 'Brunch',
    };
    return labels[key] || key.charAt(0).toUpperCase() + key.slice(1);
  },

  /**
   * Check if a school is open now based on the API's day-based hours fields.
   * School object has: mon_enabled, mon_start ("11:00:00"), mon_end ("22:00:00"), etc.
   */
  isOpenNow(school) {
    if (!school) return null;
    const now = new Date();
    const dayPrefixes = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const prefix = dayPrefixes[now.getDay()];

    const enabled = school[`${prefix}_enabled`];
    if (enabled === false) return false;
    if (enabled === undefined) return null;

    const startStr = school[`${prefix}_start`];
    const endStr = school[`${prefix}_end`];
    if (!startStr || !endStr) return null;

    const parseHHMM = (str) => {
      const parts = str.split(':');
      return parseInt(parts[0], 10) * 60 + parseInt(parts[1] || '0', 10);
    };

    const open = parseHHMM(startStr);
    const close = parseHHMM(endStr);
    const nowMins = now.getHours() * 60 + now.getMinutes();
    return nowMins >= open && nowMins < close;
  },

  clearCache() {
    schoolsCache = null;
    schoolsCacheTime = 0;
    menuCache.clear();
  },
};
