// Dining location metadata — maps Nutrislice slugs to display info
// Slugs and active_menu_types sourced from the Nutrislice API

export const DINING_LOCATIONS = [
  { slug: 'dewick-dining', name: 'Dewick', emoji: '\u{1F372}', image: 'https://api.nutrislice.com/content/asset/serve/image/jpg/397525', type: 'dining_hall', hasOrdering: false, lat: 42.4048, lng: -71.1196, description: 'All-you-care-to-eat dining hall on lower campus' },
  { slug: 'carmichael-dining-hall', name: 'Carm', emoji: '\u{1F35C}', image: 'https://api.nutrislice.com/content/asset/serve/image/jpg/397529', type: 'dining_hall', hasOrdering: false, lat: 42.4085, lng: -71.1199, description: 'All-you-care-to-eat dining hall on upper campus' },
  { slug: 'hodgdon-food-on-the-run', name: 'Hodgdon', emoji: '\u{1F961}', image: 'https://api.nutrislice.com/content/asset/serve/image/jpg/397531', type: 'grab_and_go', hasOrdering: true, lat: 42.4072, lng: -71.1210, description: 'Quick grab-and-go meals near Campus Center' },
  { slug: 'hotung-cafe', name: 'Hotung', emoji: '\u{2615}', image: 'https://api.nutrislice.com/content/asset/serve/image/jpg/397582', type: 'cafe', hasOrdering: true, lat: 42.4078, lng: -71.1205, description: 'Cafe in the Campus Center with coffee, snacks, and light meals' },
  { slug: 'commons-marketplace', name: 'Commons', emoji: '\u{1F6D2}', image: 'https://api.nutrislice.com/content/asset/serve/image/jpg/397578', type: 'cafe', hasOrdering: true, lat: 42.4076, lng: -71.1207, description: 'Marketplace with sushi, sandwiches, and convenience items' },
  { slug: 'kindlevan-cafe', name: 'Kindlevan', emoji: '\u{2615}', image: 'https://api.nutrislice.com/content/asset/serve/image/jpg/397522', type: 'cafe', hasOrdering: false, lat: 42.4065, lng: -71.1218, description: 'Cafe in the Granoff Family Hillel Center' },
  { slug: 'pax-et-lox-glatt-kosher-deli', name: 'Pax et Lox', emoji: '\u{1F96A}', image: 'https://api.nutrislice.com/content/asset/serve/image/jpg/397548', type: 'grab_and_go', hasOrdering: false, lat: 42.4064, lng: -71.1216, description: 'Glatt kosher deli in the Granoff Family Hillel Center' },
  { slug: 'tower-cafe', name: 'Tower Cafe', emoji: '\u{2615}', image: 'https://api.nutrislice.com/content/asset/serve/image/jpg/397586', type: 'cafe', hasOrdering: false, lat: 42.4063, lng: -71.1188, description: 'Cafe near the Tisch Library' },
  { slug: 'mugar-cafe', name: 'Mugar Cafe', emoji: '\u{2615}', image: 'https://api.nutrislice.com/content/asset/serve/image/jpg/397530', type: 'cafe', hasOrdering: false, lat: 42.4058, lng: -71.1185, description: 'Cafe in the Mugar building' },
  { slug: 'late-night-at-commons', name: 'Late Night', emoji: '\u{1F319}', image: 'https://api.nutrislice.com/content/asset/serve/image/jpg/397704', type: 'cafe', hasOrdering: true, lat: 42.4076, lng: -71.1207, description: 'Late-night dining options at Commons' },
  { slug: 'smfa', name: 'SMFA', emoji: '\u{1F3A8}', image: 'https://api.nutrislice.com/content/asset/serve/image/jpg/397537', type: 'cafe', hasOrdering: false, lat: 42.3413, lng: -71.0976, description: 'Cafe at the School of the Museum of Fine Arts' },
];

export const DINING_CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'dining_hall', label: 'Dining Halls' },
  { id: 'cafe', label: 'Cafes' },
  { id: 'grab_and_go', label: 'Grab & Go' },
];

export const TRANSACT_LINKS = {
  ios: 'https://apps.apple.com/us/app/transact-mobile-ordering/id1495670313',
  android: 'https://play.google.com/store/apps/details?id=com.compass.transact',
  deepLink: 'transactmobileordering://',
};

export const TYPE_LABELS = {
  dining_hall: 'Dining Hall',
  cafe: 'Cafe',
  grab_and_go: 'Grab & Go',
};
