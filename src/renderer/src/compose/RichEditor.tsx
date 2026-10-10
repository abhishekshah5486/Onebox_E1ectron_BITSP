import { useEffect, useImperativeHandle, useRef, useState, type ReactNode, type Ref } from 'react';
import { Icon, type IconName } from '../ui/Icon';
import { useFonts } from './fonts';
import styles from './RichEditor.module.css';

// What the compose footer can ask of the editor.
export interface EditorHandle {
  focus: () => void;
  startLink: () => void;
  insertText: (text: string) => void;
  insertHtml: (html: string) => void;
}

// execCommand's 1–7 scale, as Gmail uses it.
const SIZES = [
  { label: 'Small', value: '1' },
  { label: 'Normal', value: '2' },
  { label: 'Large', value: '4' },
  { label: 'Huge', value: '6' },
];

const ALIGNS: { label: string; command: string; icon: IconName }[] = [
  { label: 'Left', command: 'justifyLeft', icon: 'alignLeft' },
  { label: 'Center', command: 'justifyCenter', icon: 'alignCenter' },
  { label: 'Right', command: 'justifyRight', icon: 'alignRight' },
];

const MORE: { label: string; icon: IconName; command: string; value?: string }[] = [
  { label: 'Remove formatting', icon: 'formatClear', command: 'removeFormat' },
  { label: 'Strikethrough', icon: 'strikethrough', command: 'strikeThrough' },
  { label: 'Quote', icon: 'quote', command: 'formatBlock', value: 'blockquote' },
];

// Only web links and mail addresses become links.
const safeUrl = (value: string) => {
  const url = value.trim();
  if (/^(mailto:|https?:\/\/)/i.test(url)) return url;
  if (/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(url)) return `mailto:${url}`;
  if (/^[\w.-]+\.[a-z]{2,}(\/\S*)?$/i.test(url)) return `https://${url}`;
  return null;
};

const escapeHtml = (value: string) =>
  value.replace(/[&<>"]/g, (c) => `&${{ '&': 'amp', '<': 'lt', '>': 'gt', '"': 'quot' }[c]};`);

// The browser's editing commands; missing outside a real browser (e.g. in tests).
const exec = (command: string, value?: string) =>
  typeof document.execCommand === 'function' && document.execCommand(command, false, value);

// Keeps the selection in the editor while a toolbar control is clicked.
const keepSelection = (event: React.MouseEvent) => event.preventDefault();

// A toolbar button with a menu of choices (font, size, colour, alignment, more).
function ToolMenu({
  label,
  trigger,
  children,
  wide = false,
  onOpen,
}: {
  label: string;
  trigger: ReactNode;
  children: (close: () => void) => ReactNode;
  wide?: boolean;
  // Runs inside the click that opens it (e.g. to ask for the installed fonts).
  onOpen?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <span ref={root} className={styles.menuRoot}>
      <button
        type="button"
        className={`${styles.tool} ${wide ? styles.wideTool : ''}`}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        data-tooltip={label}
        onMouseDown={keepSelection}
        onClick={() => {
          if (!open) onOpen?.();
          setOpen((value) => !value);
        }}
      >
        {trigger}
        <Icon name="caret" size={18} />
      </button>
      {open && (
        <div className={styles.menu} role="menu" aria-label={label}>
          {children(() => setOpen(false))}
        </div>
      )}
    </span>
  );
}

// The message body: an editable area with Gmail's formatting bar. It owns its HTML once mounted;
// the parent hears every change. `variant` matches the surrounding interface.
export function RichEditor({
  initialHtml,
  onChange,
  placeholder = 'Message',
  variant = 'gmail',
  showToolbar = true,
  autoFocus = false,
  ref,
}: {
  initialHtml: string;
  onChange: (html: string, text: string) => void;
  placeholder?: string;
  variant?: 'gmail' | 'console';
  showToolbar?: boolean;
  autoFocus?: boolean;
  ref?: Ref<EditorHandle>;
}) {
  const area = useRef<HTMLDivElement>(null);
  const selection = useRef<Range | null>(null);
  const [linking, setLinking] = useState(false);
  const [link, setLink] = useState('');
  const [linkText, setLinkText] = useState('');
  const { fonts, load: loadFonts } = useFonts();
  const [font, setFont] = useState('Sans Serif');
  const colorInput = useRef<HTMLInputElement>(null);
  const [empty, setEmpty] = useState(!initialHtml);

  useEffect(() => {
    const node = area.current;
    if (!node) return;
    node.innerHTML = initialHtml;
    // Formatting as inline styles, which mail clients keep.
    exec('styleWithCSS', 'true');
    if (autoFocus) {
      node.focus();
      // The caret goes at the very start, above any signature or quoted message.
      const range = document.createRange();
      range.setStart(node, 0);
      range.collapse(true);
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(range);
    }
    // Remembers where the caret was, so toolbar menus act on it after taking focus.
    const remember = () => {
      const current = window.getSelection();
      if (current?.rangeCount && node.contains(current.anchorNode)) {
        selection.current = current.getRangeAt(0).cloneRange();
      }
    };
    document.addEventListener('selectionchange', remember);
    return () => document.removeEventListener('selectionchange', remember);
    // Set once: after this the editor's own DOM is the source of truth.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changed = () => {
    const node = area.current;
    if (!node) return;
    setEmpty(!node.textContent?.trim() && !node.querySelector('img'));
    onChange(
      node.innerHTML,
      // innerText keeps line breaks; textContent stands in where it's missing (tests).
      typeof node.innerText === 'string' ? node.innerText : (node.textContent ?? ''),
    );
  };

  const restore = () => {
    area.current?.focus();
    if (selection.current) {
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(selection.current);
    }
  };

  const run = (command: string, value?: string) => {
    restore();
    exec(command, value);
    changed();
  };

  const applyLink = () => {
    const url = safeUrl(link);
    if (!url) return;
    setLinking(false);
    const text = linkText.trim() || link.trim();
    const range = selection.current;
    // Selected words keep their formatting and just become the link.
    if (range && !range.collapsed && range.toString() === text) run('createLink', url);
    else run('insertHTML', `<a href="${escapeHtml(url)}">${escapeHtml(text)}</a>`);
  };

  useImperativeHandle(ref, () => ({
    focus: () => area.current?.focus(),
    startLink: () => {
      // The selected words become the link's text, as in Gmail.
      setLinkText(selection.current?.toString() ?? '');
      setLink('');
      setLinking(true);
    },
    insertText: (text) => run('insertText', text),
    insertHtml: (html) => {
      restore();
      // Without the editing command (or if it's refused), placed at the caret by hand.
      if (!exec('insertHTML', html)) {
        const node = area.current;
        if (!node) return;
        const range = selection.current ?? document.createRange();
        if (!selection.current) range.selectNodeContents(node);
        range.collapse(false);
        range.insertNode(range.createContextualFragment(html));
      }
      changed();
    },
  }));

  const button = (label: string, icon: IconName, action: () => void) => (
    <button
      key={label}
      type="button"
      className={styles.tool}
      aria-label={label}
      data-tooltip={label}
      onMouseDown={keepSelection}
      onClick={action}
    >
      <Icon name={icon} size={20} />
    </button>
  );

  return (
    <div className={`${styles.editor} ${styles[variant]}`}>
      <div
        ref={area}
        className={styles.area}
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
      {linking && (
        <form
          className={styles.linkCard}
          aria-label="Insert link"
          onSubmit={(event) => {
            event.preventDefault();
            applyLink();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation();
              setLinking(false);
              restore();
            }
          }}
        >
          <label className={styles.linkField}>
            <Icon name="shortText" size={20} />
            <input
              autoFocus
              aria-label="Text"
              placeholder="Text"
              value={linkText}
              onChange={(event) => setLinkText(event.target.value)}
            />
          </label>
          <span className={styles.linkRow}>
            <label className={styles.linkField}>
              <Icon name="link" size={20} />
              <input
                aria-label="Link"
                placeholder="Type or paste a link"
                value={link}
                onChange={(event) => setLink(event.target.value)}
              />
            </label>
            <button type="submit" disabled={!safeUrl(link)}>
              Apply
            </button>
          </span>
        </form>
      )}
      {showToolbar && (
        <div className={styles.toolbar} role="toolbar" aria-label="Formatting">
          {button('Undo', 'undo', () => run('undo'))}
          {button('Redo', 'redo', () => run('redo'))}
          <span className={styles.separator} />
          <ToolMenu
            label="Font"
            wide
            onOpen={() => void loadFonts()}
            trigger={<span className={styles.fontName}>{font}</span>}
          >
            {(close) =>
              fonts.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  role="menuitemradio"
                  aria-checked={font === item.label}
                  style={{ fontFamily: item.value }}
                  onMouseDown={keepSelection}
                  onClick={() => {
                    setFont(item.label);
                    run('fontName', item.value);
                    close();
                  }}
                >
                  {font === item.label && <Icon name="check" size={16} />}
                  {item.label}
                </button>
              ))
            }
          </ToolMenu>
          <span className={styles.separator} />
          <ToolMenu label="Size" trigger={<Icon name="formatSize" size={20} />}>
            {(close) =>
              SIZES.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  role="menuitem"
                  onMouseDown={keepSelection}
                  onClick={() => {
                    run('fontSize', item.value);
                    close();
                  }}
                >
                  {item.label}
                </button>
              ))
            }
          </ToolMenu>
          <span className={styles.separator} />
          {button('Bold', 'formatBold', () => run('bold'))}
          {button('Italic', 'formatItalic', () => run('italic'))}
          {button('Underline', 'formatUnderlined', () => run('underline'))}
          {/* The system colour picker; the chosen colour applies to the selection. */}
          <button
            type="button"
            className={styles.tool}
            aria-label="Text colour"
            data-tooltip="Text colour"
            onMouseDown={keepSelection}
            onClick={() => colorInput.current?.click()}
          >
            <Icon name="formatColor" size={20} />
          </button>
          <input
            ref={colorInput}
            type="color"
            className={styles.colorInput}
            aria-label="Choose text colour"
            tabIndex={-1}
            onChange={(event) => run('foreColor', event.target.value)}
          />
          <span className={styles.separator} />
          <ToolMenu label="Align" trigger={<Icon name="alignLeft" size={20} />}>
            {(close) => (
              <div className={styles.row}>
                {ALIGNS.map((item) => (
                  <button
                    key={item.command}
                    type="button"
                    role="menuitem"
                    aria-label={`Align ${item.label.toLowerCase()}`}
                    onMouseDown={keepSelection}
                    onClick={() => {
                      run(item.command);
                      close();
                    }}
                  >
                    <Icon name={item.icon} size={20} />
                  </button>
                ))}
              </div>
            )}
          </ToolMenu>
          {button('Numbered list', 'formatListNumbered', () => run('insertOrderedList'))}
          {button('Bulleted list', 'formatListBulleted', () => run('insertUnorderedList'))}
          {button('Indent less', 'indentLess', () => run('outdent'))}
          {button('Indent more', 'indentMore', () => run('indent'))}
          <span className={styles.separator} />
          <ToolMenu label="More formatting options" trigger={null}>
            {(close) => (
              <div className={styles.column}>
                {MORE.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    role="menuitem"
                    aria-label={item.label}
                    data-tooltip={item.label}
                    onMouseDown={keepSelection}
                    onClick={() => {
                      run(item.command, item.value);
                      close();
                    }}
                  >
                    <Icon name={item.icon} size={20} />
                  </button>
                ))}
              </div>
            )}
          </ToolMenu>
        </div>
      )}
    </div>
  );
}
