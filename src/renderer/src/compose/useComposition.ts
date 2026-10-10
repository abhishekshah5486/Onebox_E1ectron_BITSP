import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { composeApi, composeKeys, type Composition } from '../api/compose';
import { useAuth } from '../auth/AuthProvider';
import { describeError } from '../auth/errors';
import { useNotify } from '../ui/useNotify';
import type { ComposeRequest } from './ComposeProvider';
import { useCompose } from './ComposeProvider';
import { hasContent, MAX_ATTACHMENT_BYTES, sharedFileHtml } from './model';

const SAVE_AFTER_MS = 1_500;

export interface Upload {
  id: string;
  filename: string;
  sizeBytes: number;
  // 0 to 1, as it goes up.
  progress: number;
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
  // Files over the 25 MB limit, waiting for the person to agree to share them by link.
  const [tooLarge, setTooLarge] = useState<File[]>([]);
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

  // Runs one upload, showing its progress until it finishes either way.
  const track = useCallback(
    async <T>(file: File, upload: (onProgress: (fraction: number) => void) => Promise<T>) => {
      const id = crypto.randomUUID();
      const progress = (fraction: number) =>
        setUploads((current) =>
          current.map((u) => (u.id === id ? { ...u, progress: fraction } : u)),
        );
      setUploads((current) => [
        ...current,
        { id, filename: file.name, sizeBytes: file.size, progress: 0 },
      ]);
      try {
        return await upload(progress);
      } catch (error) {
        notify({
          type: 'error',
          header: `Couldn't attach ${file.name}.`,
          content: describeError(error),
        });
        return null;
      } finally {
        setUploads((current) => current.filter((u) => u.id !== id));
      }
    },
    [notify],
  );

  // Attaches what fits in 25 MB; anything beyond waits to be shared from cloud storage.
  const addFiles = useCallback(
    async (files: File[]) => {
      let room =
        MAX_ATTACHMENT_BYTES - latest.current.attachments.reduce((sum, a) => sum + a.sizeBytes, 0);
      const attach: File[] = [];
      const large: File[] = [];
      for (const file of files) {
        if (file.size <= room) {
          attach.push(file);
          room -= file.size;
        } else {
          large.push(file);
        }
      }
      if (large.length) setTooLarge((current) => [...current, ...large]);
      await Promise.all(
        attach.map(async (file) => {
          const attachment = await track(file, (onProgress) =>
            composeApi.upload(api, file, onProgress),
          );
          if (attachment)
            update((current) => ({ attachments: [...current.attachments, attachment] }));
        }),
      );
    },
    [api, track, update],
  );

  // The person agreed: the large files go to their cloud storage, and links to them go in the
  // message (inserted by the editor where the caret is).
  const shareTooLarge = useCallback(
    async (storageAccountId: string, insert: (html: string) => void) => {
      const files = tooLarge;
      setTooLarge([]);
      for (const file of files) {
        const shared = await track(file, (onProgress) =>
          composeApi.uploadToCloud(api, file, storageAccountId, onProgress),
        );
        if (shared) insert(sharedFileHtml(shared));
      }
    },
    [api, track, tooLarge],
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

  const send = useCallback(
    async (sendAt?: Date) => {
      if (problem) {
        notify({ type: 'error', content: problem });
        return false;
      }
      setSending(true);
      dirty.current = false;
      const sent = await compose.send(
        latest.current,
        stored.current ? draftId.current : undefined,
        sendAt,
      );
      setSending(false);
      if (!sent) dirty.current = true;
      return sent;
    },
    [compose, notify, problem],
  );

  // Closing keeps the draft (saved straight away); discarding deletes it.
  const keep = useCallback(async () => {
    await save();
    if (stored.current) notify({ type: 'info', content: 'Draft saved.' });
  }, [notify, save]);

  const discard = useCallback(async () => {
    dirty.current = false;
    // Said whenever there was something to throw away, saved yet or not.
    const anything = stored.current || hasContent(latest.current);
    if (stored.current) {
      await composeApi.deleteDraft(api, draftId.current).catch(() => {});
      void queryClient.invalidateQueries({ queryKey: composeKeys.drafts });
    }
    if (anything) notify({ type: 'info', tone: 'burgundy', content: 'Draft discarded.' });
  }, [api, notify, queryClient]);

  return {
    composition,
    update,
    uploads,
    addFiles,
    tooLarge,
    shareTooLarge,
    keepSmallOnly: () => setTooLarge([]),
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
