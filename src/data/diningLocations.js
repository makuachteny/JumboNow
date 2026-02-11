// Dining location metadata — maps Nutrislice slugs to display info
// Slugs and active_menu_types sourced from the Nutrislice API

export const DINING_LOCATIONS = [
  { slug: 'dewick-dining', name: 'Dewick', emoji: '\u{1F372}', type: 'dining_hall', hasOrdering: false },
  { slug: 'carmichael-dining-hall', name: 'Carm', emoji: '\u{1F35C}', type: 'dining_hall', hasOrdering: false },
  { slug: 'hodgdon-food-on-the-run', name: 'Hodgdon', emoji: '\u{1F961}', type: 'grab_and_go', hasOrdering: true },
  { slug: 'hotung-cafe', name: 'Hotung', emoji: '\u{2615}', type: 'cafe', hasOrdering: true },
  { slug: 'commons-marketplace', name: 'Commons', emoji: '\u{1F6D2}', type: 'cafe', hasOrdering: true },
  { slug: 'kindlevan-cafe', name: 'Kindlevan', emoji: '\u{2615}', type: 'cafe', hasOrdering: false },
  { slug: 'pax-et-lox-glatt-kosher-deli', name: 'Pax et Lox', emoji: '\u{1F96A}', type: 'grab_and_go', hasOrdering: false },
  { slug: 'tower-cafe', name: 'Tower Cafe', emoji: '\u{2615}', type: 'cafe', hasOrdering: false },
  { slug: 'mugar-cafe', name: 'Mugar Cafe', emoji: '\u{2615}', type: 'cafe', hasOrdering: false },
  { slug: 'late-night-at-commons', name: 'Late Night', emoji: '\u{1F319}', type: 'cafe', hasOrdering: true },
  { slug: 'smfa', name: 'SMFA', emoji: '\u{1F3A8}', type: 'cafe', hasOrdering: false },
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
