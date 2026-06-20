/**
 * Calculates the great-circle distance between two geographic points
 * using the Haversine formula.
 *
 * @param {number} lon1 - Longitude of point 1 (degrees)
 * @param {number} lat1 - Latitude of point 1 (degrees)
 * @param {number} lon2 - Longitude of point 2 (degrees)
 * @param {number} lat2 - Latitude of point 2 (degrees)
 * @returns {number} Distance in meters
 */
export function haversineDistanceMeters(lon1, lat1, lon2, lat2) {
  const radius = 6371000;
  const toRad = (value) => (value * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return radius * c;
}
