import EmojiPicker, { EmojiStyle, Theme } from 'emoji-picker-react';
import { useTheme } from '../theme/ThemeProvider';

// The emoji picker (emoji-picker-react), in the app's theme, using the system's own emoji so
// nothing is fetched from elsewhere.
export default function EmojiPanel({ onPick }: { onPick: (emoji: string) => void }) {
  const { resolved } = useTheme();
  return (
    <EmojiPicker
      theme={resolved === 'dark' ? Theme.DARK : Theme.LIGHT}
      emojiStyle={EmojiStyle.NATIVE}
      lazyLoadEmojis
      width={340}
      height={380}
      previewConfig={{ showPreview: false }}
      onEmojiClick={(emoji) => onPick(emoji.emoji)}
    />
  );
}
