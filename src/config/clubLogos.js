/**
 * Known Tufts organization logos.
 * Maps organizer names → public image URLs.
 * SmartIcon renders these as <Image> when the value starts with https://.
 */

const CLUB_LOGOS = {
  // A cappella — red devil logo from bubs.com
  'Beelzebubs': 'https://images.squarespace-cdn.com/content/v1/55ba4b1be4b03f052fff1bf7/1476688988118-8AZ1OH3JOBNGNZ7UKI77/Bubs_Red_Logo%402x.png',
  'The Beelzebubs': 'https://images.squarespace-cdn.com/content/v1/55ba4b1be4b03f052fff1bf7/1476688988118-8AZ1OH3JOBNGNZ7UKI77/Bubs_Red_Logo%402x.png',

  // Outdoor club — TMC logo from sustainability.tufts.edu
  'Tufts Mountain Club': 'https://sustainability.tufts.edu/wp-content/uploads/TMC-logo.png',
  'TMC': 'https://sustainability.tufts.edu/wp-content/uploads/TMC-logo.png',

  // Athletics / Recreation — Jumbos elephant mark
  'Tufts Recreation': 'https://dxbhsrqyrr690.cloudfront.net/sidearm.nextgen.sites/gotuftsjumbos.com/images/logos/site/site.png',
  'Tufts Athletics': 'https://dxbhsrqyrr690.cloudfront.net/sidearm.nextgen.sites/gotuftsjumbos.com/images/logos/site/site.png',
  'Intramural Sports': 'https://dxbhsrqyrr690.cloudfront.net/sidearm.nextgen.sites/gotuftsjumbos.com/images/logos/site/site.png',
};

/**
 * Look up a logo URL for a known Tufts organization.
 * Checks organizer_name, host display_name, and host username.
 * Returns the URL string or null.
 */
export function getOrgLogo(event) {
  if (!event) return null;

  const candidates = [
    event.organizer_name,
    event.host?.display_name,
    event.host?.username,
    event.subtitle,
  ].filter(Boolean);

  for (const name of candidates) {
    // Exact match
    if (CLUB_LOGOS[name]) return CLUB_LOGOS[name];
    // Partial match (e.g. "Tufts Mountain Club" in "Tufts Mountain Club - TMC")
    for (const [key, url] of Object.entries(CLUB_LOGOS)) {
      if (name.toLowerCase().includes(key.toLowerCase()) ||
          key.toLowerCase().includes(name.toLowerCase())) {
        return url;
      }
    }
  }
  return null;
}

/**
 * Get the best icon for an event card.
 * Priority: host avatar_url → known org logo → event icon emoji → default.
 */
export function getEventIcon(event, fallback = '🎉') {
  if (!event) return fallback;
  if (event.host?.avatar_url) return event.host.avatar_url;
  const orgLogo = getOrgLogo(event);
  if (orgLogo) return orgLogo;
  return event.icon || fallback;
}

export default CLUB_LOGOS;
