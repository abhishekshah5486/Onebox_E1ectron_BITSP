import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { composeApi, composeKeys, type Composition } from '../api/compose';
import { useAuth } from '../auth/AuthProvider';
import { describeError } from '../auth/errors';
import { useNotify } from '../ui/useNotify';
import type { ComposeRequest } from './ComposeProvider';
import { useCompose } from './ComposeProvider';
import { hasContent, MAX_ATTACHMENT_BYTES } from './model';

const SAVE_AFTER_MS = 1_500;

export interface Upload {
  id: string;
  filename: string;
  sizeBytes: number;
}

export type SaveState = 'unsaved' | 'saving' | 'saved' | 'error';

// One message being written: what it says, its draft (saved as you type), its attachments,
// and sending or throwing it away.
export function useComposition(request: ComposeRequest) {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const compose = useCompose();
  const notify = useNotify();
  const [composition, setComposition] = useState<Composition>(request.composition);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [saveState, setSaveState] = useState<SaveState>(request.draftId ? 'saved' : 'unsaved');
  const [sending, setSending] = useState(false);
  const draftId = useRef(request.draftId ?? crypto.randomUUID());
  // Whether the draft exists on the server (so discarding must delete it).
  const stored = useRef(Boolean(request.draftId));
  const dirty = useRef(false);
  const latest = useRef(composition);
  useEffect(() => {
    latest.current = composition;
  }, [composition]);

  const update = useCallback(
    (patch: Partial<Composition> | ((current: Composition) => Partial<Composition>)) => {
      dirty.current = true;
      setSaveState('unsaved');
      setComposition((current) => ({
        ...current,
        ...(typeof patch === 'function' ? patch(current) : patch),
      }));
    },
    [],
  );

  const save = useCallback(async () => {
    if (!dirty.current || !hasContent(latest.current)) return;
    dirty.current = false;
    setSaveState('saving');
    try {
      await composeApi.saveDraft(api, draftId.current, latest.current);
      stored.current = true;
      setSaveState((state) => (state === 'saving' ? 'saved' : state));
      void queryClient.invalidateQueries({ queryKey: composeKeys.drafts });
    } catch {
      dirty.current = true;
      setSaveState('error');
    }
  }, [api, queryClient]);

  useEffect(() => {
    if (!dirty.current) return;
    const timer = setTimeout(() => void save(), SAVE_AFTER_MS);
    return () => clearTimeout(timer);
  }, [composition, save]);

  const addFiles = useCallback(
    async (files: File[]) => {
      const used = latest.current.attachments.reduce((sum, a) => sum + a.sizeBytes, 0);
      const adding = files.reduce((sum, file) => sum + file.size, 0);
      if (used + adding > MAX_ATTACHMENT_BYTES) {
        notify({
          type: 'error',
          content: 'Attachments can be up to 25 MB in total. Share bigger files with a link.',
        });
        return;
      }
      await Promise.all(
        files.map(async (file) => {
          const id = crypto.randomUUID();
          setUploads((current) => [...current, { id, filename: file.name, sizeBytes: file.size }]);
          try {
            const attachment = await composeApi.upload(api, file);
            update((current) => ({ attachments: [...current.attachments, attachment] }));
          } catch (error) {
            notify({
              type: 'error',
              header: `Couldn't attach ${file.name}.`,
              content: describeError(error),
            });
          } finally {
            setUploads((current) => current.filter((upload) => upload.id !== id));
          }
        }),
      );
    },
    [api, notify, update],
  );

  const removeAttachment = useCallback(
    (blobKey: string) =>
      update((current) => ({
        attachments: current.attachments.filter((a) => a.blobKey !== blobKey),
      })),
    [update],
  );

  // What stops it going yet, in words, or null when it's ready.
  const problem =
    composition.to.length + composition.cc.length + composition.bcc.length === 0
      ? 'Add at least one recipient.'
      : !composition.accountId
        ? 'Choose the account to send from.'
        : uploads.length > 0
          ? 'Wait for attachments to finish uploading.'
          : null;

  const send = useCallback(async () => {
    if (problem) {
      notify({ type: 'error', content: problem });
      return false;
    }
    setSending(true);
    dirty.current = false;
    const sent = await compose.send(latest.current, stored.current ? draftId.current : undefined);
    setSending(false);
    if (!sent) dirty.current = true;
    return sent;
  }, [compose, notify, problem]);

  // Closing keeps the draft (saved straight away); discarding deletes it.
  const keep = useCallback(async () => {
    await save();
    if (stored.current) notify({ type: 'info', content: 'Draft saved.' });
  }, [notify, save]);

  const discard = useCallback(async () => {
    dirty.current = false;
    if (!stored.current) return;
    await composeApi.deleteDraft(api, draftId.current).catch(() => {});
    void queryClient.invalidateQueries({ queryKey: composeKeys.drafts });
    notify({ type: 'info', tone: 'burgundy', content: 'Draft discarded.' });
  }, [api, notify, queryClient]);

  return {
    composition,
    update,
    uploads,
    addFiles,
    removeAttachment,
    saveState,
    sending,
    problem,
    send,
    keep,
    discard,
  };
}

export type CompositionState = ReturnType<typeof useComposition>;
