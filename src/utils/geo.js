import Point from "@arcgis/core/geometry/Point.js";

/**
 * Calculate the distance in meters between two coordinates using the Haversine formula.
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

/**
 * Get the user's current location as an ArcGIS Point via the Geolocation API.
 * Returns null if the location cannot be obtained.
 */
export function getUserLocationPoint() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve(
          new Point({
            longitude: position.coords.longitude,
            latitude: position.coords.latitude,
            spatialReference: { wkid: 4326 }
          })
        );
      },
      () => resolve(null),
      {
        enableHighAccuracy: true,
        timeout: 10000
      }
    );
  });
}

/**
 * Create a query object for a GeoJSONLayer with common options.
 * Eliminates repetitive createQuery() + property assignment patterns.
 */
export function createLayerQuery(layer, { where, geometry, spatialRelationship, outFields, returnGeometry } = {}) {
  const query = layer.createQuery();

  if (where !== undefined) {
    query.where = where;
  }

  if (geometry !== undefined) {
    query.geometry = geometry;
  }

  if (spatialRelationship !== undefined) {
    query.spatialRelationship = spatialRelationship;
  }

  if (outFields !== undefined) {
    query.outFields = outFields;
  }

  if (returnGeometry !== undefined) {
    query.returnGeometry = returnGeometry;
  }

  return query;
}
