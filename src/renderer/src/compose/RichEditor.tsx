import { useEffect, useRef, useState } from 'react';
import { Icon, type IconName } from '../ui/Icon';
import styles from './RichEditor.module.css';

const COMMANDS: { command: string; icon: IconName; label: string }[] = [
  { command: 'bold', icon: 'formatBold', label: 'Bold' },
  { command: 'italic', icon: 'formatItalic', label: 'Italic' },
  { command: 'underline', icon: 'formatUnderlined', label: 'Underline' },
  { command: 'insertUnorderedList', icon: 'formatListBulleted', label: 'Bulleted list' },
  { command: 'insertOrderedList', icon: 'formatListNumbered', label: 'Numbered list' },
];

// Only web links and mail addresses become links.
const safeUrl = (value: string) => {
  const url = value.trim();
  if (/^mailto:/i.test(url)) return url;
  if (/^https?:\/\//i.test(url)) return url;
  if (/^[\w.-]+\.[a-z]{2,}(\/\S*)?$/i.test(url)) return `https://${url}`;
  return null;
};

// The message body: an editable area with a formatting bar. It owns its HTML once mounted;
// the parent hears every change. `variant` matches the surrounding interface.
export function RichEditor({
  initialHtml,
  onChange,
  placeholder = 'Message',
  variant = 'gmail',
  showToolbar = true,
  autoFocus = false,
  minHeight,
}: {
  initialHtml: string;
  onChange: (html: string, text: string) => void;
  placeholder?: string;
  variant?: 'gmail' | 'console';
  showToolbar?: boolean;
  autoFocus?: boolean;
  minHeight?: number;
}) {
  const area = useRef<HTMLDivElement>(null);
  const [linking, setLinking] = useState(false);
  const [link, setLink] = useState('');
  const [empty, setEmpty] = useState(!initialHtml);
  const saved = useRef<Range | null>(null);

  useEffect(() => {
    if (!area.current) return;
    area.current.innerHTML = initialHtml;
    if (autoFocus) {
      area.current.focus();
      // The caret goes at the very start, above any signature or quoted message.
      const range = document.createRange();
      range.setStart(area.current, 0);
      range.collapse(true);
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(range);
    }
    // Set once: after this the editor's own DOM is the source of truth.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changed = () => {
    const node = area.current;
    if (!node) return;
    setEmpty(!node.textContent?.trim() && !node.querySelector('img'));
    // innerText keeps line breaks; textContent stands in where it's missing (tests).
    onChange(
      node.innerHTML,
      typeof node.innerText === 'string' ? node.innerText : (node.textContent ?? ''),
    );
  };

  const run = (command: string, value?: string) => {
    area.current?.focus();
    document.execCommand(command, false, value);
    changed();
  };

  const startLink = () => {
    const selection = window.getSelection();
    saved.current = selection && selection.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
    setLink('');
    setLinking(true);
  };

  const applyLink = () => {
    const url = safeUrl(link);
    setLinking(false);
    if (!url) return;
    area.current?.focus();
    if (saved.current) {
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(saved.current);
    }
    if (saved.current && !saved.current.collapsed) run('createLink', url);
    else
      run(
        'insertHTML',
        `<a href="${url.replace(/"/g, '&quot;')}">${url.replace(/</g, '&lt;')}</a>`,
      );
  };

  return (
    <div className={`${styles.editor} ${styles[variant]}`}>
      <div
        ref={area}
        className={styles.area}
        style={minHeight ? { minHeight } : undefined}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Message body"
        data-placeholder={placeholder}
        data-empty={empty || undefined}
        onInput={changed}
        onBlur={changed}
      />
      {showToolbar && (
        <div className={styles.toolbar} role="toolbar" aria-label="Formatting">
          {COMMANDS.map((item) => (
            <button
              key={item.command}
              type="button"
              className={styles.tool}
              aria-label={item.label}
              data-tooltip={item.label}
              // Keep the selection in the editor while clicking the button.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => run(item.command)}
            >
              <Icon name={item.icon} size={18} />
            </button>
          ))}
          <button
            type="button"
            className={styles.tool}
            aria-label="Insert link"
            data-tooltip="Insert link"
            onMouseDown={(event) => event.preventDefault()}
            onClick={startLink}
          >
            <Icon name="link" size={18} />
          </button>
          <button
            type="button"
            className={styles.tool}
            aria-label="Remove formatting"
            data-tooltip="Remove formatting"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => run('removeFormat')}
          >
            <Icon name="formatClear" size={18} />
          </button>
          {linking && (
            <form
              className={styles.linkForm}
              onSubmit={(event) => {
                event.preventDefault();
                applyLink();
              }}
            >
              <input
                autoFocus
                aria-label="Link address"
                placeholder="https://"
                value={link}
                onChange={(event) => setLink(event.target.value)}
                onKeyDown={(event) => event.key === 'Escape' && setLinking(false)}
              />
              <button type="submit">Apply</button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
