/**
 * Phone Contact Sync Service — VipChat
 * Uses the Web Contacts API (navigator.contacts) to sync phone contacts.
 * Falls back to manual import for browsers that don't support it.
 */

import api from './api';

class ContactSyncService {
  constructor() {
    this.isSupported = 'contacts' in navigator && 'ContactsManager' in window;
    this.syncInProgress = false;
  }

  /**
   * Check if native contact sync is available on this device.
   */
  isNativeSupported() {
    return this.isSupported;
  }

  /**
   * Request native contact access and sync contacts with VipChat backend.
   * Returns { synced: number, new: number, contacts: [] }
   */
  async syncNativeContacts(onProgress = null) {
    if (!this.isSupported) {
      return { supported: false, error: 'Web Contacts API not available on this browser/device' };
    }
    if (this.syncInProgress) {
      return { error: 'Sync already in progress' };
    }

    this.syncInProgress = true;
    try {
      const props = ['name', 'tel', 'email', 'icon'];
      const contacts = await navigator.contacts.select(props, { multiple: true });

      if (!contacts || contacts.length === 0) {
        return { synced: 0, new: 0, message: 'No contacts selected' };
      }

      if (onProgress) onProgress({ step: 'uploading', total: contacts.length });

      // Normalize contacts
      const normalized = contacts.flatMap(c => {
        return (c.tel || []).map(phone => ({
          name: (c.name || [])[0] || 'Unknown',
          phone_number: phone.replace(/\s+/g, ''),
          email: (c.email || [])[0] || null,
        }));
      }).filter(c => c.phone_number);

      // Send to backend in batches of 100
      const batchSize = 100;
      let totalSynced = 0;
      let totalNew = 0;
      const allMatches = [];

      for (let i = 0; i < normalized.length; i += batchSize) {
        const batch = normalized.slice(i, i + batchSize);
        if (onProgress) onProgress({ step: 'syncing', done: i, total: normalized.length });

        try {
          const res = await api.post('/contacts/sync', { contacts: batch });
          totalSynced += res.data.synced || 0;
          totalNew += res.data.new_contacts || 0;
          if (res.data.matches) allMatches.push(...res.data.matches);
        } catch (err) {
          console.warn('Contact batch sync error:', err?.response?.data || err.message);
        }
      }

      return {
        supported: true,
        synced: totalSynced,
        new: totalNew,
        matches: allMatches,
        total_uploaded: normalized.length,
      };
    } catch (err) {
      if (err.name === 'SecurityError') {
        return { supported: true, error: 'Contact access denied by user' };
      }
      return { supported: true, error: err.message };
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Import contacts from a VCF (vCard) file.
   * Returns parsed contacts array.
   */
  async importFromVCF(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const vcfText = e.target.result;
          const contacts = this._parseVCF(vcfText);
          const res = await api.post('/contacts/sync', { contacts });
          resolve({ ...res.data, parsed: contacts.length });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  /**
   * Parse a VCF string into an array of { name, phone_number, email }.
   */
  _parseVCF(vcfText) {
    const contacts = [];
    const cards = vcfText.split(/BEGIN:VCARD/i).filter(Boolean);
    for (const card of cards) {
      const nameMatch = card.match(/FN[^:]*:(.+)/i);
      const telMatches = [...card.matchAll(/TEL[^:]*:([+\d\s\-().]+)/ig)];
      const emailMatch = card.match(/EMAIL[^:]*:([^\r\n]+)/i);
      const name = nameMatch ? nameMatch[1].trim() : 'Unknown';
      const email = emailMatch ? emailMatch[1].trim() : null;
      for (const tm of telMatches) {
        const phone = tm[1].replace(/\s+/g, '').trim();
        if (phone) {
          contacts.push({ name, phone_number: phone, email });
        }
      }
    }
    return contacts;
  }

  /**
   * Manually add a single contact.
   */
  async addContact(phoneNumber, name = null) {
    const res = await api.post('/contacts', {
      phone_number: phoneNumber,
      name,
    });
    return res.data;
  }

  /**
   * Get all synced VipChat contacts.
   */
  async getContacts() {
    const res = await api.get('/contacts');
    return res.data;
  }

  /**
   * Search VipChat users by phone number.
   */
  async searchByPhone(query) {
    const res = await api.get('/contacts/search', { params: { q: query } });
    return res.data;
  }
}

const contactSync = new ContactSyncService();
export default contactSync;
