/**
 * Map links for the venue, derived from its coordinates and address so a
 * site writes neither a bounding box nor an encoded address: the
 * OpenStreetMap embed (no API key, no cookies) and link, and directions in
 * Google and Apple Maps. Any of the four named in `venue.map` wins over the
 * derived one. Published to templates as `mapLinks(venue)` by ./mod.ts.
 */

/** What is read from the `venue` concept. */
export interface VenueLocation {
  name: string;
  address: { street: string; city: string };
  coordinates: { lat: number; lon: number };
  map?: {
    embedUrl?: string;
    osmUrl?: string;
    googleUrl?: string;
    appleUrl?: string;
  };
}

export interface MapLinks {
  /** The <iframe src>: OpenStreetMap centred on the venue with a marker. */
  embedUrl: string;
  /** "View larger map": the same spot on openstreetmap.org. */
  osmUrl: string;
  /** Directions to the venue in Google Maps. */
  googleUrl: string;
  /** Directions to the venue in Apple Maps, public transport selected. */
  appleUrl: string;
}

/** Half the width and height of the embed's bounding box, in degrees: a few blocks around the venue. */
const BOX = { lon: 0.007, lat: 0.003 };

/** Five decimals, no exponent. */
function deg(value: number): string {
  return String(Math.round(value * 100000) / 100000);
}

export function mapLinks(venue: VenueLocation): MapLinks {
  const { lat, lon } = venue.coordinates;
  const destination = encodeURIComponent(
    `${venue.name}, ${venue.address.street}, ${venue.address.city}`,
  );
  const address = encodeURIComponent(
    `${venue.address.street}, ${venue.address.city}`,
  );
  const bbox = [lon - BOX.lon, lat - BOX.lat, lon + BOX.lon, lat + BOX.lat]
    .map(deg).join("%2C");
  return {
    embedUrl: venue.map?.embedUrl ??
      `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${deg(lat)}%2C${deg(lon)}`,
    osmUrl: venue.map?.osmUrl ??
      `https://www.openstreetmap.org/?mlat=${deg(lat)}&mlon=${deg(lon)}#map=17/${deg(lat)}/${deg(lon)}`,
    googleUrl: venue.map?.googleUrl ??
      `https://www.google.com/maps/dir/?api=1&destination=${destination}`,
    appleUrl: venue.map?.appleUrl ??
      `https://maps.apple.com/?daddr=${address}&dirflg=r`,
  };
}
