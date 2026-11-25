import Button from '@cloudscape-design/components/button';
import Link from '@cloudscape-design/components/link';
import type { HubNode, RecordDetails } from '../../api/hub';
import type { BannerProps } from './Banner';
import { formatWhen, upper } from './parts';
import { daysLeft } from './TrashView';

export type BannerSlot = 'page' | 'details' | 'indexing' | 'attachments' | 'content';
export type Banners = Record<BannerSlot, (BannerProps & { key: string })[]>;

export interface BannerActions {
  restore: () => void;
  indexAgain: () => void;
  summarizeAgain: () => void;
  open: (id: string) => void;
  // Shows only the attachments that weren't indexed (or all of them again).
  toggleProblems: () => void;
  problemsOnly: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const SETTLED_SHORT = new Set(['EMPTY', 'FILE_TYPE_NOT_SUPPORTED', 'PASSWORD_PROTECTED', 'FAILED']);
const BUSY = new Set(['QUEUED', 'IN_PROGRESS']);

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// What a record's page tells about it, card by card, worded as the console does: a short
// header, then what it means and what to do.
export function recordBanners(
  record: RecordDetails,
  attachments: HubNode[],
  retentionDays: number,
  actions: BannerActions,
  now = Date.now(),
): Banners {
  const noun = record.recordType === 'MAIL' ? 'email' : 'file';
  const status = upper(record.status);
  const banners: Banners = { page: [], details: [], indexing: [], attachments: [], content: [] };
  const indexAgain = <Button onClick={actions.indexAgain}>Index again</Button>;

  if (record.deletedAt) {
    const left = daysLeft(record.deletedAt, retentionDays, now);
    const due = formatWhen(Date.parse(record.deletedAt) + retentionDays * DAY_MS).split(',')[0];
    const restore = <Button onClick={actions.restore}>Restore</Button>;
    banners.page.push(
      record.deleteSource === 'source'
        ? {
            key: 'source',
            tone: 'burgundy',
            solid: true,
            header: 'Deleted from your mailbox',
            children: `This ${noun} was deleted in your mailbox, so it was moved to Recently deleted. It isn't included in search results and will be permanently deleted in ${plural(left, 'day')} (${due}) unless you restore it.`,
            action: restore,
          }
        : {
            key: 'user',
            tone: 'warning',
            solid: true,
            header: `You moved this ${noun} to Recently deleted`,
            children: `It isn't included in search results and will be permanently deleted in ${plural(left, 'day')} (${due}) unless you restore it.`,
            action: restore,
          },
    );
  } else if (BUSY.has(status)) {
    banners.page.push({
      key: 'busy',
      tone: 'progress',
      solid: true,
      header: 'Indexing in progress',
      children: 'It appears in search results once indexing completes.',
    });
  }

  if (record.attachedTo)
    banners.details.push({
      key: 'attached',
      tone: 'info',
      children: (
        <>
          This file is an attachment of{' '}
          <Link
            href={`#${record.attachedTo.id}`}
            onFollow={(e) => {
              e.preventDefault();
              actions.open(record.attachedTo!.id);
            }}
          >
            {record.attachedTo.name}
          </Link>
          . It’s deleted and restored with it.
        </>
      ),
    });
  if (record.version > 1)
    banners.details.push({
      key: 'version',
      tone: 'info',
      children: `Replaced ${plural(record.version - 1, 'time')}. Only the latest version is searched.`,
    });

  if (status === 'FAILED')
    banners.indexing.push({
      key: 'failed',
      tone: 'error',
      header: 'Indexing failed',
      children: record.reason ?? `This ${noun} couldn't be read, so it isn't searchable.`,
      action: indexAgain,
    });
  else if (status === 'PASSWORD_PROTECTED')
    banners.indexing.push({
      key: 'locked',
      tone: 'warning',
      header: 'Password protected',
      children: 'Remove the password and upload it again to make it searchable.',
    });
  else if (status === 'FILE_TYPE_NOT_SUPPORTED')
    banners.indexing.push({
      key: 'type',
      tone: 'warning',
      header: 'File type not supported',
      children: 'Its text can’t be read, so it isn’t searchable.',
    });
  else if (status === 'EMPTY')
    banners.indexing.push({
      key: 'empty',
      tone: 'info',
      header: 'No text found',
      children: `It has no readable text, so it isn't searchable.`,
    });
  else if (status === 'COMPLETED' && record.pointCount === 0)
    banners.indexing.push({
      key: 'nothing',
      tone: 'warning',
      header: 'Nothing was indexed',
      children: 'No searchable text came out of it. Index it again to retry.',
      action: indexAgain,
    });

  const short = attachments.filter((a) => SETTLED_SHORT.has(a.indexingStatus ?? ''));
  const busy = attachments.filter((a) => BUSY.has(a.indexingStatus ?? ''));
  if (short.length)
    banners.attachments.push({
      key: 'short',
      tone: 'warning',
      header: `${short.length} of ${plural(attachments.length, 'attachment')} ${short.length === 1 ? 'wasn’t' : 'weren’t'} indexed`,
      children:
        'They aren’t included in search results. Open one to see why, or select them and choose Index again.',
      action: (
        <Button onClick={actions.toggleProblems}>
          {actions.problemsOnly ? 'Show all' : 'Show them'}
        </Button>
      ),
    });
  if (busy.length)
    banners.attachments.push({
      key: 'busy',
      tone: 'progress',
      header: `Indexing ${plural(busy.length, 'attachment')}`,
      children: 'They appear in search results once indexing completes.',
    });

  const classify = record.stageStates?.find((s) => s.stage === 'classify');
  if (record.classifyStatus === 'queued' || record.classifyStatus === 'deferred')
    banners.content.push({
      key: 'pending',
      tone: 'info',
      header: 'Summary pending',
      children: `Appears once the ${noun} is analyzed.`,
    });
  else if (record.classifyStatus === 'skipped' || record.classifyStatus === 'failed')
    banners.content.push({
      key: 'none',
      tone: record.classifyStatus === 'failed' ? 'error' : 'info',
      header: record.classifyStatus === 'failed' ? 'Summary failed' : 'Not summarized',
      children: `${classify?.reason ?? 'No summary was made.'} Search isn't affected.`,
      // Only the summary is made again, from the text already indexed.
      ...(record.classifyStatus === 'failed' && status === 'COMPLETED'
        ? { action: <Button onClick={actions.summarizeAgain}>Summarize again</Button> }
        : {}),
    });

  for (const slot of Object.keys(banners) as BannerSlot[]) banners[slot].sort(bySeverity);
  return banners;
}

const SEVERITY: Record<string, number> = {
  error: 0,
  burgundy: 1,
  warning: 2,
  progress: 3,
  info: 4,
  success: 5,
};
// The most pressing first, as a card shows only the first until asked for the rest.
const bySeverity = (a: BannerProps, b: BannerProps) => SEVERITY[a.tone]! - SEVERITY[b.tone]!;

// Every banner the page can show, in the cards it shows them in (for a look at them all).
export function sampleBanners(actions: BannerActions): Banners {
  const banners = sampleList(actions);
  for (const slot of Object.keys(banners) as BannerSlot[]) banners[slot].sort(bySeverity);
  return banners;
}

function sampleList(actions: BannerActions): Banners {
  const button = (text: string) => <Button onClick={() => undefined}>{text}</Button>;
  return {
    page: [
      {
        key: 'busy',
        tone: 'progress',
        solid: true,
        header: 'Indexing in progress',
        children: 'It appears in search results once indexing completes.',
      },
      {
        key: 'user',
        tone: 'warning',
        solid: true,
        header: 'You moved this email to Recently deleted',
        children:
          'It isn’t included in search results and will be permanently deleted in 9 days (5 Dec 2026) unless you restore it.',
        action: button('Restore'),
      },
      {
        key: 'source',
        tone: 'burgundy',
        solid: true,
        header: 'Deleted from your mailbox',
        children:
          'This email was deleted in your mailbox, so it was moved to Recently deleted. It isn’t included in search results and will be permanently deleted in 9 days (5 Dec 2026) unless you restore it.',
        action: button('Restore'),
      },
    ],
    details: [
      {
        key: 'attached',
        tone: 'info',
        children: (
          <>
            This file is an attachment of <Link href="#">Quarter pack</Link>. It is deleted and
            restored together with its email.
          </>
        ),
      },
      {
        key: 'version',
        tone: 'info',
        children: 'Replaced 2 times. Only the latest version is searched.',
      },
    ],
    indexing: [
      {
        key: 'failed',
        tone: 'error',
        header: 'Indexing failed',
        children: 'Larger than 100 MB, so it wasn’t read.',
        action: button('Index again'),
      },
      {
        key: 'locked',
        tone: 'warning',
        header: 'Password protected',
        children: 'Remove the password and upload it again to make it searchable.',
      },
      {
        key: 'empty',
        tone: 'info',
        header: 'No text found',
        children: 'It has no readable text, so it isn’t searchable.',
      },
    ],
    attachments: [
      {
        key: 'short',
        tone: 'warning',
        header: '1 of 2 attachments wasn’t indexed',
        children:
          'They aren’t included in search results. Open one to see why, or select them and choose Index again.',
        action: <Button onClick={actions.toggleProblems}>Show them</Button>,
      },
      {
        key: 'busy',
        tone: 'progress',
        header: 'Indexing 1 attachment',
        children: 'They appear in search results once indexing completes.',
      },
    ],
    content: [
      {
        key: 'pending',
        tone: 'info',
        header: 'Summary pending',
        children: 'Appears once the email is analyzed.',
      },
      {
        key: 'none',
        tone: 'error',
        header: 'Summary failed',
        children: 'The model didn’t respond in time. Search isn’t affected.',
        action: button('Summarize again'),
      },
      {
        key: 'success',
        tone: 'success',
        header: 'Summary ready',
        children: 'Summarized, categorized and tagged.',
      },
    ],
  };
}
