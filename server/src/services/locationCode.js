/**
 * Builds location codes in the format: Building-StorageType-StorageId-SpaceNumber
 * e.g. RS-Rack-A-1, WS-Cabinet-D-9
 */
export function buildLocationCode(building, storageType, storageId, spaceNumber) {
  const b = String(building || '').trim().toUpperCase();
  const t = String(storageType || '').trim();
  const id = String(storageId || '').trim().toUpperCase();
  const sn = parseInt(spaceNumber, 10);
  if (!b || !t || !id || isNaN(sn) || sn < 1 || sn > 24) {
    return null;
  }
  return `${b}-${t}-${id}-${sn}`;
}

/** Normalize building code to 2-letter uppercase (RS, WS, etc.) */
export function normalizeBuildingCode(code) {
  return String(code || '').trim().toUpperCase().slice(0, 10);
}

/** Normalize storage type (Rack, Cabinet, Bag, etc.) */
export function normalizeStorageType(type) {
  const t = String(type || '').trim();
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}
