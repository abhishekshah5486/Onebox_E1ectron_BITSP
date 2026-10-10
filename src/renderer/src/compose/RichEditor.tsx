import { useEffect, useImperativeHandle, useRef, useState, type ReactNode, type Ref } from 'react';
import { Icon, type IconName } from '../ui/Icon';
import { Floating } from './Floating';
import { useFonts } from './fonts';
import styles from './RichEditor.module.css';

// What the compose footer can ask of the editor.
export interface EditorHandle {
  focus: () => void;
  // Opens the link card, or closes it if it's open.
  toggleLink: () => void;
  insertText: (text: string) => void;
  insertHtml: (html: string) => void;
}

// execCommand's 1–7 scale, as Gmail uses it.
// Each drawn at its own size in the menu, as Gmail does.
const SIZES = [
  { label: 'Small', value: '1', px: 13 },
  { label: 'Normal', value: '2', px: 16 },
  { label: 'Large', value: '4', px: 22 },
  { label: 'Huge', value: '6', px: 34 },
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
  placement,
  maxHeight,
  menuClassName,
  onOpen,
}: {
  label: string;
  trigger: ReactNode;
  children: (close: () => void) => ReactNode;
  wide?: boolean;
  placement: 'above' | 'below';
  maxHeight?: number;
  // Extra styling for this menu, e.g. the font list's width.
  menuClassName?: string | undefined;
  // Runs before it opens (e.g. reading the installed fonts, which needs this click).
  onOpen?: () => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={button}
        type="button"
        className={`${styles.tool} ${wide ? styles.wideTool : ''}`}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        data-tooltip={label}
        onMouseDown={keepSelection}
        onClick={() => {
          if (open) return setOpen(false);
          void Promise.resolve(onOpen?.()).then(() => setOpen(true));
        }}
      >
        {trigger}
        <Icon name="caret" size={18} />
      </button>
      {open && (
        <Floating
          anchor={button}
          label={label}
          placement={placement}
          {...(maxHeight && { maxHeight })}
          className={`${styles.menu} ${menuClassName ?? ''}`}
          onClose={() => setOpen(false)}
        >
          {children(() => setOpen(false))}
        </Floating>
      )}
    </>
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
  attachments,
  ref,
}: {
  initialHtml: string;
  onChange: (html: string, text: string) => void;
  placeholder?: string;
  variant?: 'gmail' | 'console';
  showToolbar?: boolean;
  autoFocus?: boolean;
  // Shown between the message and the formatting bar, as Gmail lists attachments.
  attachments?: ReactNode;
  ref?: Ref<EditorHandle>;
}) {
  const placement = variant === 'gmail' ? 'above' : 'below';
  const area = useRef<HTMLDivElement>(null);
  const selection = useRef<Range | null>(null);
  const [linking, setLinking] = useState(false);
  const [link, setLink] = useState('');
  const [linkText, setLinkText] = useState('');
  const linkCard = useRef<HTMLDivElement>(null);

  // A click anywhere else closes the link card (its own toggle button excepted, which does).
  useEffect(() => {
    if (!linking) return;
    const away = (event: PointerEvent) => {
      const target = event.target as Element;
      if (!linkCard.current?.contains(target) && !target.closest('[data-link-toggle]')) {
        setLinking(false);
      }
    };
    document.addEventListener('pointerdown', away, true);
    return () => document.removeEventListener('pointerdown', away, true);
  }, [linking]);
  const { fonts, load: loadFonts } = useFonts();
  const [font, setFont] = useState('Sans Serif');
  const [size, setSize] = useState('2');
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
    const node = area.current;
    if (!node) return;
    restore();
    const range = selection.current ?? document.createRange();
    if (!selection.current) {
      range.selectNodeContents(node);
      range.collapse(false);
    }
    // The link replaces the selection; the caret goes after it, past a space, so what's typed
    // next is plain text rather than more of the link.
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.textContent = text;
    range.deleteContents();
    const after = document.createTextNode('\u00a0');
    range.insertNode(after);
    range.insertNode(anchor);
    const caret = document.createRange();
    caret.setStartAfter(after);
    caret.collapse(true);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(caret);
    selection.current = caret;
    changed();
  };

  useImperativeHandle(ref, () => ({
    focus: () => area.current?.focus(),
    toggleLink: () => {
      if (linking) return setLinking(false);
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
        // Not a form: it sits inside the compose form, and submitting it would send the message.
        <div
          ref={linkCard}
          role="group"
          className={styles.linkCard}
          aria-label="Insert link"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation();
              setLinking(false);
              restore();
            } else if (event.key === 'Enter') {
              event.preventDefault();
              event.stopPropagation();
              applyLink();
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
            <button type="button" disabled={!safeUrl(link)} onClick={applyLink}>
              Apply
            </button>
          </span>
        </div>
      )}
      {attachments}
      {showToolbar && (
        <div className={styles.toolbar} role="toolbar" aria-label="Formatting">
          {button('Undo', 'undo', () => run('undo'))}
          {button('Redo', 'redo', () => run('redo'))}
          <span className={styles.separator} />
          <ToolMenu
            label="Font"
            wide
            placement={placement}
            maxHeight={360}
            menuClassName={styles.fontMenu}
            onOpen={loadFonts}
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
                  <span className={styles.tick}>
                    {font === item.label && <Icon name="check" size={18} />}
                  </span>
                  {item.label}
                </button>
              ))
            }
          </ToolMenu>
          <span className={styles.separator} />
          <ToolMenu
            label="Size"
            placement={placement}
            trigger={<Icon name="formatSize" size={20} />}
          >
            {(close) =>
              SIZES.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  role="menuitemradio"
                  aria-checked={size === item.value}
                  className={styles.sizeItem}
                  style={{ fontSize: item.px }}
                  onMouseDown={keepSelection}
                  onClick={() => {
                    setSize(item.value);
                    run('fontSize', item.value);
                    close();
                  }}
                >
                  <span className={styles.tick}>
                    {size === item.value && <Icon name="check" size={20} />}
                  </span>
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
          <ToolMenu
            label="Align"
            placement={placement}
            trigger={<Icon name="alignLeft" size={20} />}
          >
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
          <ToolMenu label="More formatting options" placement={placement} trigger={null}>
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
