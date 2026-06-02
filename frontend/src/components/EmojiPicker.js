import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';

const CATEGORIES = [
  {
    id: 'smileys', icon: '😀', label: 'Smileys',
    emojis: [
      '😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩',
      '😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐',
      '🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒',
      '🤕','🤢','🤮','🤧','🥵','🥶','🥴','😵','🤯','🤠','🥳','🥸','😎','🤓','🧐',
      '😕','😟','🙁','☹️','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭',
      '😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️',
    ],
  },
  {
    id: 'gestures', icon: '👋', label: 'People',
    emojis: [
      '👋','🤚','🖐️','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆',
      '🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','🫶','👐','🤲','🤝','🙏',
      '✍️','💅','🤳','💪','🦾','🦿','🦵','🦶','👂','🦻','👃','🫀','🫁','🧠','🦷','🦴',
      '👀','👁️','👅','👄','💋','👶','🧒','👦','👧','🧑','👱','👨','🧔','👩','🧓','👴',
    ],
  },
  {
    id: 'hearts', icon: '❤️', label: 'Hearts',
    emojis: [
      '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','❤️‍🩹','💕','💞','💓','💗',
      '💖','💝','💘','💟','☮️','✝️','☪️','🕉️','✡️','🔯','🕎','☯️','☦️','🛐','⛎','♈',
      '💯','💢','💥','💫','💦','💨','🕳️','💬','💭','💤','🔔','🔕','🎵','🎶','🎼','🔊',
    ],
  },
  {
    id: 'animals', icon: '🐶', label: 'Animals',
    emojis: [
      '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐻‍❄️','🐨','🐯','🦁','🐮','🐷','🐸','🐵',
      '🙈','🙉','🙊','🐔','🐧','🐦','🐤','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝',
      '🐛','🦋','🐌','🐞','🐜','🦟','🦗','🕷️','🦂','🐢','🐍','🦎','🦖','🦕','🐙','🦑',
      '🦐','🦞','🦀','🐡','🐟','🐠','🐬','🐳','🐋','🦈','🐊','🐅','🐆','🦓','🦍','🦧',
    ],
  },
  {
    id: 'food', icon: '🍎', label: 'Food',
    emojis: [
      '🍎','🍊','🍋','🍇','🍓','🫐','🍈','🍑','🍒','🍍','🥭','🍌','🍉','🍐','🍏','🥝',
      '🍅','🫒','🥥','🥑','🍆','🥔','🥕','🌽','🌶️','🫑','🥒','🥬','🥦','🧄','🧅','🍄',
      '🥗','🥘','🍲','🫕','🥫','🍱','🍘','🍙','🍚','🍛','🍜','🍝','🍠','🍢','🍣','🍤',
      '🍥','🥮','🍡','🥟','🥠','🥡','🦪','🍦','🍧','🍨','🍩','🍪','🎂','🍰','🧁','🥧',
      '🍫','🍬','🍭','🍮','🍯','🍼','🥛','☕','🫖','🍵','🧃','🥤','🧋','🍶','🍺','🍻',
    ],
  },
  {
    id: 'activities', icon: '⚽', label: 'Activity',
    emojis: [
      '⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🏓','🏸','🏒','🥍','🏑','🥅',
      '⛳','🏹','🎣','🤿','🎽','🎿','🛷','🥌','🏋️','🤼','🤸','⛹️','🤺','🏇','⛷️','🏂',
      '🏌️','🏄','🚣','🧘','🚴','🏆','🥇','🥈','🥉','🏅','🎖️','🎗️','🎫','🎟️','🎪','🤹',
      '🎭','🎨','🎬','🎤','🎧','🎼','🎹','🥁','🎷','🎺','🎸','🪕','🎻','🎲','♟️','🎯',
    ],
  },
  {
    id: 'travel', icon: '✈️', label: 'Travel',
    emojis: [
      '🚗','🚕','🚙','🚌','🚎','🏎️','🚓','🚑','🚒','🚐','🛻','🚚','🚛','🚜','🏍️','🛵',
      '🚲','🛴','🛺','🚁','🛸','🚀','✈️','🛩️','🛫','🛬','🪂','💺','🚂','🚃','🚄','🚅',
      '🚆','🚇','🚈','🚉','🚊','🚝','🚞','🚋','🚌','🚍','🚎','🚐','🚑','🚒','🛳️','⛴️',
      '🛥️','🚢','⛵','🚤','🛶','⛽','🚧','⚓','🗺️','🗿','🗽','🗼','🏰','🏯','🎡','🎢',
    ],
  },
  {
    id: 'objects', icon: '💡', label: 'Objects',
    emojis: [
      '⌚','📱','📲','💻','⌨️','🖥️','🖨️','🖱️','🖲️','💽','💾','💿','📀','📷','📸','📹',
      '🎥','📽️','🎞️','📞','☎️','📟','📠','📺','📻','🧭','⏱️','⏲️','⏰','🕰️','⌛','⏳',
      '📡','🔋','🔌','💡','🔦','🕯️','🧯','🛢️','💰','💳','💎','⚖️','🔧','🔨','🪛','🔩',
      '🪝','🗜️','🔑','🗝️','🔒','🔓','🚪','🪑','🛋️','🛏️','🛁','🪠','🧴','🧷','🧹','🧺',
      '📦','📫','📪','📬','📭','📮','🗳️','✏️','✒️','🖊️','🖋️','📝','📁','📂','🗂️','📋',
    ],
  },
  {
    id: 'symbols', icon: '💯', label: 'Symbols',
    emojis: [
      '💯','🔞','📵','🚫','❌','⭕','🛑','⛔','📛','🚷','📵','🚯','🚳','🚱','🔇','📴',
      '✅','☑️','🔘','🔴','🟠','🟡','🟢','🔵','🟣','🟤','⚫','⚪','🔺','🔻','🔷','🔶',
      '🔹','🔸','🔲','🔳','▪️','▫️','◾','◽','◼️','◻️','⬛','⬜','🟥','🟧','🟨','🟩',
      '🔠','🔡','🔢','🔣','🔤','🅰️','🆎','🅱️','🆑','🆒','🆓','ℹ️','🆔','Ⓜ️','🆕','🆖',
      '🅾️','🆗','🅿️','🆘','🆙','🆚','🈁','🈂️','🈷️','🈶','🈯','🉐','🈹','🈚','🈲','🉑',
    ],
  },
  {
    id: 'flags', icon: '🏳️', label: 'Flags',
    emojis: [
      '🏳️','🏴','🏁','🚩','🏳️‍🌈','🏳️‍⚧️','🏴‍☠️','🇦🇫','🇦🇱','🇩🇿','🇦🇩','🇦🇴','🇦🇺','🇦🇹','🇧🇩','🇧🇪',
      '🇧🇫','🇧🇷','🇬🇧','🇨🇦','🇨🇳','🇨🇴','🇨🇩','🇪🇬','🇫🇷','🇩🇪','🇬🇭','🇮🇳','🇮🇩','🇮🇷','🇮🇶','🇮🇱',
      '🇮🇹','🇯🇵','🇯🇴','🇰🇪','🇰🇼','🇲🇦','🇲🇽','🇳🇬','🇰🇵','🇵🇰','🇵🇭','🇵🇱','🇷🇺','🇸🇦','🇿🇦','🇪🇸',
      '🇸🇩','🇸🇾','🇹🇿','🇹🇭','🇹🇷','🇺🇬','🇺🇦','🇦🇪','🇺🇸','🇻🇪','🇾🇪','🇿🇲','🇿🇼','🇸🇳','🇪🇹','🇨🇲',
    ],
  },
];

const RECENT_KEY = 'bitese_recent_emojis';
const MAX_RECENT = 30;

function getRecent() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; }
}
function addRecent(emoji) {
  const prev = getRecent().filter(e => e !== emoji);
  localStorage.setItem(RECENT_KEY, JSON.stringify([emoji, ...prev].slice(0, MAX_RECENT)));
}

export default function EmojiPicker({ onEmojiSelect }) {
  const [activeCat, setActiveCat] = useState('recent');
  const [search, setSearch] = useState('');
  const [recent, setRecent] = useState(getRecent);
  const searchRef = useRef(null);

  useEffect(() => {
    setTimeout(() => searchRef.current?.focus(), 50);
  }, []);

  const handleSelect = (emoji) => {
    addRecent(emoji);
    setRecent(getRecent());
    onEmojiSelect(emoji);
  };

  const allEmojis = CATEGORIES.flatMap(c => c.emojis);
  const searchResults = search
    ? allEmojis.filter(e => {
        const q = search.toLowerCase();
        return e.includes(q) || [...e].some(() => true);
      }).slice(0, 60)
    : null;

  const displayCat = activeCat === 'recent'
    ? { id: 'recent', label: 'Recently Used', emojis: recent.length ? recent : CATEGORIES[0].emojis.slice(0, 24) }
    : CATEGORIES.find(c => c.id === activeCat) || CATEGORIES[0];

  const emojisToShow = searchResults || displayCat.emojis;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.97 }}
      transition={{ duration: 0.18 }}
      className="w-[320px] bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
      onClick={e => e.stopPropagation()}
    >
      {/* Search */}
      <div className="px-3 pt-3 pb-2">
        <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2">
          <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={searchRef}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search emoji..."
            className="flex-1 bg-transparent text-sm outline-none text-gray-700 placeholder-gray-400"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Category tabs */}
      {!search && (
        <div className="flex items-center gap-0.5 px-2 overflow-x-auto scrollbar-none border-b border-gray-100 pb-0">
          <button
            onClick={() => setActiveCat('recent')}
            title="Recent"
            className={`flex-shrink-0 px-2 py-1.5 text-base rounded-lg transition ${activeCat === 'recent' ? 'bg-green-50 text-[#25D366]' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}
          >
            🕐
          </button>
          {CATEGORIES.map(c => (
            <button
              key={c.id}
              onClick={() => setActiveCat(c.id)}
              title={c.label}
              className={`flex-shrink-0 px-2 py-1.5 text-base rounded-lg transition ${activeCat === c.id ? 'bg-green-50 text-[#25D366]' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}
            >
              {c.icon}
            </button>
          ))}
        </div>
      )}

      {/* Category label */}
      <div className="px-3 pt-2 pb-1">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
          {search ? `Results for "${search}"` : displayCat.label}
        </p>
      </div>

      {/* Emoji grid */}
      <div className="px-2 pb-3 h-[200px] overflow-y-auto">
        {emojisToShow.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <span className="text-3xl mb-2">🔍</span>
            <p className="text-xs">No emojis found</p>
          </div>
        ) : (
          <div className="grid grid-cols-8 gap-0.5">
            {emojisToShow.map((emoji, i) => (
              <button
                key={`${emoji}-${i}`}
                onClick={() => handleSelect(emoji)}
                className="w-9 h-9 flex items-center justify-center text-xl rounded-lg hover:bg-gray-100 active:scale-90 transition-all"
                title={emoji}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
