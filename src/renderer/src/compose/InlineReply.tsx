import { useState } from 'react';
import type { ReplyMode } from '../api/compose';
import type { Message } from '../api/mail';
import { useAccounts, usePreferences } from '../api/queries';
import { Icon, type IconName } from '../ui/Icon';
import { ComposeForm } from './ComposeForm';
import styles from './InlineReply.module.css';
import { replyComposition } from './model';
import { useComposition } from './useComposition';

const MODES: { mode: ReplyMode; label: string; icon: IconName }[] = [
  { mode: 'reply', label: 'Reply', icon: 'reply' },
  { mode: 'replyAll', label: 'Reply all', icon: 'replyAll' },
  { mode: 'forward', label: 'Forward', icon: 'forward' },
];

function ReplyBox({
  message,
  mode,
  onDone,
}: {
  message: Message;
  mode: ReplyMode;
  onDone: () => void;
}) {
  const accounts = useAccounts();
  const preferences = usePreferences();
  const state = useComposition({
    composition: replyComposition(
      message,
      mode,
      (accounts.data ?? []).map((account) => account.emailAddress),
      preferences.data?.signature ?? null,
    ),
  });
  const label = MODES.find((item) => item.mode === mode)!;
  return (
    <section className={styles.box} aria-label={label.label}>
      <div className={styles.mode}>
        <Icon name={label.icon} size={18} />
        {label.label}
      </div>
      <ComposeForm state={state} inline onDone={onDone} />
    </section>
  );
}

// Gmail's buttons under a conversation, opening the reply right there.
export function InlineReply({ message }: { message: Message }) {
  const [mode, setMode] = useState<ReplyMode | null>(null);
  if (mode)
    return <ReplyBox key={mode} message={message} mode={mode} onDone={() => setMode(null)} />;
  const many = message.to.length + message.cc.length > 1;
  return (
    <div className={styles.buttons}>
      {MODES.filter((item) => item.mode !== 'replyAll' || many).map((item) => (
        <button key={item.mode} type="button" onClick={() => setMode(item.mode)}>
          <Icon name={item.icon} size={18} />
          {item.label}
        </button>
      ))}
    </div>
  );
}
