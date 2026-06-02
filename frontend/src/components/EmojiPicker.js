import React from 'react';

const EMOJI_LIST = ['😀', '😂', '❤️', '😍', '🎉', '🔥', '👍', '😢', '😡', '🤔', '💪', '👏'];

function EmojiPicker({ onEmojiSelect }) {
  return (
    <div className="absolute bottom-20 left-4 bg-white rounded-lg shadow-2xl p-3 z-50">
      <div className="grid grid-cols-6 gap-2">
        {EMOJI_LIST.map((emoji, index) => (
          <button
            key={index}
            onClick={() => onEmojiSelect(emoji)}
            className="text-2xl hover:scale-125 transition"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

export default EmojiPicker;
