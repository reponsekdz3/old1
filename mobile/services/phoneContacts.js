import * as Contacts from 'expo-contacts';
import { Cache } from './cache';
import api from './api';

/**
 * Normalize a phone number to E.164-ish format for matching.
 * Strips spaces, dashes, parentheses, dots.
 */
function normalizePhone(phone) {
  return phone.replace(/[\s\-().]/g, '');
}

/**
 * Request contacts permission and fetch all phone contacts from the device.
 * Returns { granted: bool, contacts: Contacts[] }
 */
export async function fetchDeviceContacts() {
  const { status } = await Contacts.requestPermissionsAsync();
  if (status !== 'granted') {
    return { granted: false, contacts: [] };
  }
  const { data } = await Contacts.getContactsAsync({
    fields: [
      Contacts.Fields.Name,
      Contacts.Fields.PhoneNumbers,
      Contacts.Fields.Image,
    ],
    sort: Contacts.SortTypes.FirstName,
  });
  return { granted: true, contacts: data || [] };
}

/**
 * Extract all unique phone numbers from device contacts,
 * returning an array of { name, phoneNumber, rawContact }.
 */
export function extractPhoneNumbers(deviceContacts) {
  const seen = new Set();
  const result = [];
  for (const contact of deviceContacts) {
    if (!contact.phoneNumbers?.length) continue;
    const name = contact.name || 'Unknown';
    for (const ph of contact.phoneNumbers) {
      const raw = ph.number || '';
      const norm = normalizePhone(raw);
      if (!norm || seen.has(norm)) continue;
      seen.add(norm);
      result.push({ name, phoneNumber: raw, normalizedPhone: norm, rawContact: contact });
    }
  }
  return result;
}

/**
 * Full sync: fetch device contacts → send to backend → return
 * { granted, vipchatContacts, phoneOnlyContacts, lastSynced }
 *
 * Results are cached in AsyncStorage so they're available offline.
 */
export async function syncPhoneContacts({ force = false } = {}) {
  // Return cached result if recent (within 30 minutes) unless forced
  if (!force) {
    const cached = await Cache.getPhoneContacts();
    if (cached && Date.now() - (cached.lastSynced || 0) < 30 * 60 * 1000) {
      return cached;
    }
  }

  const { granted, contacts: deviceContacts } = await fetchDeviceContacts();
  if (!granted) {
    return { granted: false, vipchatContacts: [], phoneOnlyContacts: [], lastSynced: null };
  }

  const entries = extractPhoneNumbers(deviceContacts);
  if (entries.length === 0) {
    return { granted: true, vipchatContacts: [], phoneOnlyContacts: [], lastSynced: Date.now() };
  }

  // Send all phone numbers to backend
  const phoneNumbers = entries.map(e => e.phoneNumber);
  let registered = [];
  let unregistered = [];

  try {
    const { data } = await api.post('/contacts/sync-phone', { phone_numbers: phoneNumbers });
    registered = data.registered || [];
    unregistered = data.unregistered || [];
  } catch (err) {
    console.warn('[phoneContacts] sync failed:', err.message);
    // Use cached data if available
    const cached = await Cache.getPhoneContacts();
    if (cached) return cached;
    return { granted: true, vipchatContacts: [], phoneOnlyContacts: entries, lastSynced: null };
  }

  // Build vipchatContacts with device name overlay
  const registeredPhones = new Set(registered.map(r => normalizePhone(r.phone_number)));
  const vipchatContacts = registered.map(r => {
    // Find the device contact name for this phone
    const match = entries.find(e => normalizePhone(e.phoneNumber) === normalizePhone(r.phone_number));
    return {
      ...r,
      contact_name: match?.name || r.full_name,
      contact_user_id: r.id,
    };
  });

  // Phone-only contacts: on device but not on VipChat
  const phoneOnlyContacts = entries
    .filter(e => !registeredPhones.has(e.normalizedPhone))
    .map(e => ({ name: e.name, phoneNumber: e.phoneNumber }));

  const result = {
    granted: true,
    vipchatContacts,
    phoneOnlyContacts,
    lastSynced: Date.now(),
  };

  await Cache.setPhoneContacts(result);
  return result;
}
