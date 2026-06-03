import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Modal, FlatList,
  StyleSheet, SafeAreaView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PHONE_COUNTRIES, getFlag, DEFAULT_COUNTRY } from '../data/countries';
import { COLORS } from '../config';

export default function PhoneInput({ value, onChange, error, placeholder = '701 234 567', autoFocus }) {
  const [country, setCountry] = useState(() => {
    if (value && value.startsWith('+')) {
      const sorted = [...PHONE_COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length);
      return sorted.find(c => value.startsWith(c.dialCode)) || DEFAULT_COUNTRY;
    }
    return DEFAULT_COUNTRY;
  });
  const [local, setLocal] = useState(() => {
    if (value && value.startsWith(country.dialCode)) return value.slice(country.dialCode.length).trim();
    return value || '';
  });
  const [modalVisible, setModalVisible] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = PHONE_COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.dialCode.includes(search) ||
    c.iso2.toLowerCase().includes(search.toLowerCase())
  );

  const handleLocalChange = (text) => {
    const digits = text.replace(/[^\d\s\-()]/g, '');
    setLocal(digits);
    const full = digits.trim() ? `${country.dialCode}${digits.replace(/\s/g, '')}` : '';
    onChange(full);
  };

  const handleCountrySelect = (c) => {
    setCountry(c);
    setModalVisible(false);
    setSearch('');
    const full = local.trim() ? `${c.dialCode}${local.replace(/\s/g, '')}` : '';
    onChange(full);
  };

  const renderCountry = useCallback(({ item }) => (
    <TouchableOpacity style={styles.countryRow} onPress={() => handleCountrySelect(item)} activeOpacity={0.7}>
      <Text style={styles.flagText}>{getFlag(item.iso2)}</Text>
      <Text style={styles.countryName} numberOfLines={1}>{item.name}</Text>
      <Text style={styles.dialCode}>{item.dialCode}</Text>
    </TouchableOpacity>
  ), [local]);

  return (
    <View>
      <View style={[styles.container, error && styles.containerError]}>
        <TouchableOpacity style={styles.countryBtn} onPress={() => setModalVisible(true)}>
          <Text style={styles.flagText}>{getFlag(country.iso2)}</Text>
          <Text style={styles.dialCodeSmall}>{country.dialCode}</Text>
          <Ionicons name="chevron-down" size={12} color={COLORS.gray} />
        </TouchableOpacity>
        <View style={styles.divider} />
        <TextInput
          style={styles.input}
          value={local}
          onChangeText={handleLocalChange}
          placeholder={placeholder}
          placeholderTextColor={COLORS.gray}
          keyboardType="phone-pad"
          autoFocus={autoFocus}
          returnKeyType="done"
        />
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Country</Text>
            <TouchableOpacity onPress={() => { setModalVisible(false); setSearch(''); }}>
              <Ionicons name="close" size={24} color={COLORS.dark} />
            </TouchableOpacity>
          </View>
          <View style={styles.searchRow}>
            <Ionicons name="search" size={16} color={COLORS.gray} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search country or code..."
              placeholderTextColor={COLORS.gray}
              autoFocus
            />
            {search ? (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={16} color={COLORS.gray} />
              </TouchableOpacity>
            ) : null}
          </View>
          <FlatList
            data={filtered}
            keyExtractor={item => `${item.iso2}-${item.dialCode}`}
            renderItem={renderCountry}
            keyboardShouldPersistTaps="handled"
            getItemLayout={(_, index) => ({ length: 52, offset: 52 * index, index })}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 14,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  containerError: { borderColor: COLORS.danger },
  countryBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 14 },
  flagText: { fontSize: 20 },
  dialCodeSmall: { fontSize: 13, fontWeight: '600', color: COLORS.dark, minWidth: 32 },
  divider: { width: 1, height: 24, backgroundColor: COLORS.border },
  input: { flex: 1, fontSize: 15, color: COLORS.dark, paddingHorizontal: 12, paddingVertical: 14 },
  errorText: { color: COLORS.danger, fontSize: 12, marginTop: 4, marginLeft: 4 },
  modal: { flex: 1, backgroundColor: '#fff' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.dark },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 12, backgroundColor: COLORS.lightGray, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  searchInput: { flex: 1, fontSize: 15, color: COLORS.dark },
  countryRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border, gap: 12 },
  countryName: { flex: 1, fontSize: 15, color: COLORS.dark },
  dialCode: { fontSize: 14, fontWeight: '600', color: COLORS.accent },
});
