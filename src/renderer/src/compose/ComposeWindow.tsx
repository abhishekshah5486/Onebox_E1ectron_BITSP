import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ComposeForm } from './ComposeForm';
import type { ComposeWindowState } from './ComposeProvider';
import { useCompose } from './ComposeProvider';
import styles from './ComposeWindow.module.css';
import { useComposition } from './useComposition';
import { IconButton } from '../ui/IconButton';

// Gmail's compose window: docked at the bottom right, minimised to its title bar, or full screen.
export function ComposeWindow({ window: request }: { window: ComposeWindowState }) {
  const { close } = useCompose();
  const state = useComposition(request);
  const [minimized, setMinimized] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const subject = state.composition.subject.trim() || 'New Message';
  // Gmail's title says when the draft is being saved.
  const title = state.saveState === 'saving' ? 'Draft saving…' : subject;
  const done = () => close(request.key);
  const keepAndClose = () => {
    void state.keep();
    done();
  };

  useEffect(() => {
    if (!maximized) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setMaximized(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [maximized]);

  const panel = (
    <section
      className={`${styles.window} ${minimized ? styles.minimized : ''} ${maximized ? styles.maximized : ''}`}
      role="dialog"
      aria-label={subject}
    >
      <header className={styles.header} onClick={() => minimized && setMinimized(false)}>
        <h2>{title}</h2>
        <span onClick={(event) => event.stopPropagation()}>
          <IconButton
            size="small"
            icon="minimize"
            label={minimized ? 'Restore' : 'Minimise'}
            onClick={() => {
              setMaximized(false);
              setMinimized((value) => !value);
            }}
          />
          <IconButton
            size="small"
            icon={maximized ? 'closeFullscreen' : 'openInFull'}
            label={maximized ? 'Exit full screen' : 'Full screen'}
            onClick={() => {
              setMinimized(false);
              setMaximized((value) => !value);
            }}
          />
          <IconButton size="small" icon="close" label="Save and close" onClick={keepAndClose} />
        </span>
      </header>
      {!minimized && <ComposeForm state={state} onDone={done} />}
    </section>
  );

  if (!maximized) return panel;
  return createPortal(
    <div className={styles.backdrop} onMouseDown={() => setMaximized(false)}>
      <div onMouseDown={(event) => event.stopPropagation()}>{panel}</div>
    </div>,
    document.body,
  );
}

// Every open compose window, side by side from the right.
export function ComposeDock() {
  const { windows } = useCompose();
  if (windows.length === 0) return null;
  return (
    <div className={styles.dock}>
      {windows.map((window) => (
        <ComposeWindow key={window.key} window={window} />
      ))}
    </div>
  );
}
