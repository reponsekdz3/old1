import * as Contacts from 'expo-contacts';
import { Cache } from './cache';
import api from './api';

function normalizePhone(phone) {
  return phone.replace(/[\s\-().+]/g, '');
}

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
 * Auto-sync phone contacts with backend
 * Returns matched VipChat users and unregistered contacts
 */
export async function syncPhoneContacts({ force = false } = {}) {
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

  const phoneNumbers = entries.map(e => e.phoneNumber);
  let registered = [];
  let unregistered = [];

  try {
    const { data } = await api.post('/contacts/sync-phone', { phone_numbers: phoneNumbers });
    registered = data.registered || [];
    unregistered = data.unregistered || [];
  } catch (err) {
    console.warn('[phoneContacts] Sync failed:', err.message);
    const cached = await Cache.getPhoneContacts();
    if (cached) return cached;
    return { granted: true, vipchatContacts: [], phoneOnlyContacts: entries, lastSynced: null };
  }

  const registeredPhones = new Set(registered.map(r => normalizePhone(r.phone_number)));
  const vipchatContacts = registered.map(r => {
    const match = entries.find(e => normalizePhone(e.phoneNumber) === normalizePhone(r.phone_number));
    return {
      ...r,
      contact_name: match?.name || r.full_name,
      contact_user_id: r.id,
    };
  });

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

/**
 * Get cached contacts (no network call)
 */
export async function getCachedContacts() {
  const cached = await Cache.getPhoneContacts();
  return cached || { granted: false, vipchatContacts: [], phoneOnlyContacts: [], lastSynced: null };
}

/**
 * Auto-trigger sync on app launch/login
 */
export async function autoSyncOnLogin() {
  try {
    const result = await syncPhoneContacts({ force: true });
    console.log('[ContactSync] Auto-sync completed:', result.vipchatContacts.length, 'VipChat users found');
    return result;
  } catch (err) {
    console.warn('[ContactSync] Auto-sync failed:', err);
    return null;
  }
}
