import EmojiPicker, { EmojiStyle, Theme } from 'emoji-picker-react';
import type { CSSProperties } from 'react';
import { useTheme } from '../theme/ThemeProvider';
import styles from './EmojiPanel.module.css';

// The picker's colours from compose's own, so it matches the window in either theme.
const COLORS = {
  '--epr-bg-color': 'var(--ob-compose-menu)',
  '--epr-category-label-bg-color': 'var(--ob-compose-menu)',
  '--epr-text-color': 'var(--ob-compose-text)',
  '--epr-category-label-text-color': 'var(--ob-compose-muted)',
  '--epr-hover-bg-color': 'var(--ob-compose-hover)',
  '--epr-focus-bg-color': 'var(--ob-compose-hover)',
  '--epr-highlight-color': 'var(--ob-compose-send)',
  '--epr-category-icon-active-color': 'var(--ob-compose-send)',
  '--epr-search-input-bg-color': 'transparent',
  '--epr-search-input-bg-color-active': 'transparent',
  '--epr-search-border-color-active': 'var(--ob-compose-send)',
  '--epr-search-border-color': 'var(--ob-compose-chip-line)',
  '--epr-picker-border-color': 'transparent',
};
const THEMED = Object.fromEntries(
  Object.entries(COLORS).flatMap(([name, value]) => [
    [name, value],
    [name.replace('--epr-', '--epr-dark-'), value],
  ]),
) as CSSProperties;

// The emoji picker (emoji-picker-react), dressed like Gmail's: Google's emoji, a rounded search
// box, and the app's colours.
export default function EmojiPanel({ onPick }: { onPick: (emoji: string) => void }) {
  const { resolved } = useTheme();
  return (
    <div className={styles.panel}>
      <EmojiPicker
        theme={resolved === 'dark' ? Theme.DARK : Theme.LIGHT}
        emojiStyle={EmojiStyle.GOOGLE}
        skinTonesDisabled
        lazyLoadEmojis
        width={380}
        height={360}
        searchPlaceHolder="Search"
        previewConfig={{ showPreview: false }}
        style={THEMED}
        onEmojiClick={(emoji) => onPick(emoji.emoji)}
      />
    </div>
  );
}
