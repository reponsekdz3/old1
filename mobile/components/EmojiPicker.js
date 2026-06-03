import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, TextInput,
  StyleSheet, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../config';

const CATEGORIES = [
  { id: 'smileys', icon: '😀', emojis: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙','😋','😛','😜','🤪','😝','🤑','🤗','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🤧','🥵','🥶','😵','🤯','🥳','😎','🤓','😕','😟','🙁','☹️','😮','😳','🥺','😦','😢','😭','😱','😤','😡','😠','🤬','😈','👿','💀'] },
  { id: 'gestures', icon: '👋', emojis: ['👋','🤚','🖐️','✋','👌','✌️','🤞','👈','👉','👆','👇','☝️','👍','👎','✊','👊','👏','🙌','👐','🤲','🤝','🙏','💪','👀','👅','👄','💋','👶','🧒','👦','👧','🧑','👨','👩','👴','👵'] },
  { id: 'hearts', icon: '❤️', emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','💕','💞','💓','💗','💖','💝','💘','💟','💯','💥','💫','💦','💨','💬','💭','💤','🔔','🎵','🎶','✨','⭐','🌟','💫'] },
  { id: 'animals', icon: '🐶', emojis: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐔','🐧','🐦','🦆','🦅','🦉','🐺','🐗','🐴','🦄','🐝','🦋','🐌','🐞','🐜','🐢','🐍','🦎','🐙','🦑','🐟','🐬','🐋','🦈','🐊','🦓','🦍'] },
  { id: 'food', icon: '🍎', emojis: ['🍎','🍊','🍋','🍇','🍓','🍌','🍉','🍑','🍒','🍍','🥭','🥝','🍅','🥑','🍆','🥕','🌽','🥒','🍔','🍕','🍟','🌮','🌯','🍜','🍝','🍱','🍣','🍤','🍦','🍧','🍨','🍩','🍪','🎂','🍰','🧁','☕','🍵','🧃','🥤','🍺','🍻','🍷','🥂','🍸'] },
  { id: 'activities', icon: '⚽', emojis: ['⚽','🏀','🏈','⚾','🎾','🏐','🏉','🎱','🏓','🏸','⛳','🎣','🎽','🎿','🛷','🏋️','🤼','🤸','⛹️','🏇','⛷️','🏂','🏄','🚣','🧘','🚴','🏆','🥇','🥈','🥉','🏅','🎖️','🎫','🎪','🎭','🎨','🎬','🎤','🎧','🎼','🎹','🥁','🎷','🎺','🎸','🎻','🎲','♟️','🎯'] },
  { id: 'travel', icon: '✈️', emojis: ['🚗','🚕','🚙','🚌','🏎️','🚓','🚑','🚒','🛻','🚚','🚛','🚜','🏍️','🛵','🚲','🛺','🚁','🛸','🚀','✈️','🛩️','🚂','🚅','🚇','🚊','🛳️','🛥️','🚢','⛵','🚤','⛽','🗺️','🗿','🗽','🗼','🏰','🏯','🎡','🎢','🌍','🌎','🌏','🌐','🏝️','🏜️','🏔️','⛰️','🌋','🏕️'] },
  { id: 'objects', icon: '💡', emojis: ['⌚','📱','💻','⌨️','🖥️','📷','📸','📹','🎥','📞','☎️','📺','📻','🧭','⏱️','⏰','🕰️','🔋','🔌','💡','🔦','💎','🔧','🔨','🔑','🗝️','🔒','🔓','🚪','🛋️','🛏️','🛁','🧴','🧹','📦','📫','✏️','📝','📁','📂','📊','📈','📉','✂️','🖇️','📌','📍','🗑️'] },
  { id: 'symbols', icon: '💯', emojis: ['💯','🔞','📵','🚫','❌','⭕','🛑','⛔','📛','✅','☑️','🔴','🟠','🟡','🟢','🔵','🟣','🟤','⚫','⚪','🔺','🔻','🔷','🔶','🔹','🔸','🔲','🔳','▪️','▫️','◾','◽','⬛','⬜','🟥','🟧','🟨','🟩','🟦','🟪','🟫','💠','🔃','🔄','🔙','🔚','🔛','🔜','🔝'] },
];

const GRID_COLS = 8;

export default function EmojiPicker({ onSelect }) {
  const [activeCat, setActiveCat] = useState('smileys');
  const [search, setSearch] = useState('');

  const allEmojis = CATEGORIES.flatMap(c => c.emojis);
  const currentEmojis = search
    ? allEmojis.filter(e => true).slice(0, 60)
    : (CATEGORIES.find(c => c.id === activeCat)?.emojis || []);

  const rows = [];
  for (let i = 0; i < currentEmojis.length; i += GRID_COLS) {
    rows.push(currentEmojis.slice(i, i + GRID_COLS));
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <Ionicons name="search" size={14} color={COLORS.gray} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search emoji..."
          placeholderTextColor={COLORS.gray}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={14} color={COLORS.gray} />
          </TouchableOpacity>
        ) : null}
      </View>

      {!search && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catRow} contentContainerStyle={{ paddingHorizontal: 4 }}>
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.catBtn, activeCat === cat.id && styles.catBtnActive]}
              onPress={() => setActiveCat(cat.id)}
            >
              <Text style={styles.catIcon}>{cat.icon}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <ScrollView style={styles.grid} showsVerticalScrollIndicator={false}>
        {rows.map((row, ri) => (
          <View key={ri} style={styles.row}>
            {row.map((emoji, ei) => (
              <TouchableOpacity
                key={`${emoji}-${ei}`}
                style={styles.emojiBtn}
                onPress={() => onSelect(emoji)}
                activeOpacity={0.6}
              >
                <Text style={styles.emoji}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    margin: 10, backgroundColor: COLORS.lightGray, borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 7,
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.dark },
  catRow: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border },
  catBtn: { padding: 8, borderRadius: 8, marginHorizontal: 2 },
  catBtnActive: { backgroundColor: '#E8F5E9' },
  catIcon: { fontSize: 20 },
  grid: { height: 200, paddingHorizontal: 4 },
  row: { flexDirection: 'row' },
  emojiBtn: { width: '12.5%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  emoji: { fontSize: 22 },
});
