// Shared campus location data used by MapScreen, FreeFoodScreen, etc.

export const LOCATION_CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'library', label: 'Libraries' },
  { id: 'dining', label: 'Dining' },
  { id: 'academic', label: 'Academic' },
  { id: 'athletic', label: 'Athletic' },
  { id: 'residential', label: 'Residential' },
];

export const CAMPUS_LOCATIONS = [
  { id: '1', name: 'Tisch Library', category: 'library', lat: 42.4063, lng: -71.1192, description: 'Main campus library with study spaces and research resources', emoji: '\u{1F4D6}' },
  { id: '2', name: 'Hirsh Health Sciences Library', category: 'library', lat: 42.3990, lng: -71.1089, description: 'Health sciences library on the Boston campus', emoji: '\u{1F4D5}' },
  { id: '3', name: 'Campus Center', category: 'dining', lat: 42.4078, lng: -71.1205, description: 'Student hub with Hotung Cafe, meeting rooms, and the bookstore', emoji: '\u{1F48E}' },
  { id: '4', name: 'Carmichael Dining', category: 'dining', lat: 42.4085, lng: -71.1199, description: 'Upper campus dining hall', emoji: '\u{1F35C}' },
  { id: '5', name: 'Dewick-MacPhie Dining', category: 'dining', lat: 42.4048, lng: -71.1196, description: 'Lower campus dining hall', emoji: '\u{1F372}' },
  { id: '6', name: 'Hodgdon Good-To-Go', category: 'dining', lat: 42.4072, lng: -71.1210, description: 'Quick grab-and-go food options', emoji: '\u{1F961}' },
  { id: '7', name: 'Barnum Hall', category: 'academic', lat: 42.4068, lng: -71.1201, description: 'Home to Biology and Chemistry departments', emoji: '\u{1F52C}' },
  { id: '8', name: 'Halligan Hall', category: 'academic', lat: 42.4070, lng: -71.1178, description: 'Computer Science department', emoji: '\u{26A1}' },
  { id: '9', name: 'Anderson Hall', category: 'academic', lat: 42.4060, lng: -71.1200, description: 'Economics and Political Science', emoji: '\u{1F4CA}' },
  { id: '10', name: 'Aidekman Arts Center', category: 'academic', lat: 42.4055, lng: -71.1183, description: 'Fine arts, galleries, and performance spaces', emoji: '\u{1F308}' },
  { id: '11', name: 'Granoff Music Center', category: 'academic', lat: 42.4052, lng: -71.1175, description: 'Music department and performance hall', emoji: '\u{1F3B7}' },
  { id: '12', name: 'Steve Tisch Sports & Fitness Center', category: 'athletic', lat: 42.4095, lng: -71.1165, description: 'Main gym, pool, and fitness facilities', emoji: '\u{1F4AA}' },
  { id: '13', name: 'Gantcher Center', category: 'athletic', lat: 42.4042, lng: -71.1202, description: 'Athletic facility with courts and track', emoji: '\u{1F3C6}' },
  { id: '14', name: 'Bello Field', category: 'athletic', lat: 42.4090, lng: -71.1150, description: 'Outdoor athletic field', emoji: '\u{26BD}' },
  { id: '15', name: 'Zimman Field', category: 'athletic', lat: 42.4098, lng: -71.1158, description: 'Football and lacrosse field', emoji: '\u{1F3C8}' },
  { id: '16', name: 'Carmichael Hall', category: 'residential', lat: 42.4087, lng: -71.1195, description: 'Upperclass residential hall', emoji: '\u{1F3E1}' },
  { id: '17', name: 'Haskell Hall', category: 'residential', lat: 42.4080, lng: -71.1190, description: 'Residential hall near campus center', emoji: '\u{1F3E1}' },
  { id: '18', name: 'South Hall', category: 'residential', lat: 42.4045, lng: -71.1190, description: 'Residential hall with suite-style living', emoji: '\u{1F3E1}' },
  { id: '19', name: 'Sophia Gordon Hall', category: 'residential', lat: 42.4040, lng: -71.1205, description: 'Newest residential hall with modern amenities', emoji: '\u{2728}' },
];
