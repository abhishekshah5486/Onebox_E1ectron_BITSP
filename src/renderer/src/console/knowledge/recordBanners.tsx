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
      children: `This ${noun} is being read and indexed. It appears in search results once indexing completes.`,
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
          . It is deleted and restored together with its email.
        </>
      ),
    });
  if (record.version > 1)
    banners.details.push({
      key: 'version',
      tone: 'info',
      children: `This file was replaced ${plural(record.version - 1, 'time')}. Only the latest version is searched.`,
    });

  if (status === 'FAILED')
    banners.indexing.push({
      key: 'failed',
      tone: 'error',
      header: 'Indexing failed',
      children: `${record.reason ?? `This ${noun} couldn't be indexed.`} It isn't included in search results.`,
      action: indexAgain,
    });
  else if (status === 'PASSWORD_PROTECTED')
    banners.indexing.push({
      key: 'locked',
      tone: 'warning',
      header: 'Password protected',
      children:
        'This file is encrypted, so its text can’t be read. Remove the password and upload it again to make it searchable.',
    });
  else if (status === 'FILE_TYPE_NOT_SUPPORTED')
    banners.indexing.push({
      key: 'type',
      tone: 'warning',
      header: 'File type not supported',
      children:
        'Text can’t be read from this kind of file, so it isn’t searchable. It stays listed with its details.',
    });
  else if (status === 'EMPTY')
    banners.indexing.push({
      key: 'empty',
      tone: 'info',
      header: 'No text found',
      children: `This ${noun} has no readable text, so it doesn't appear in search results.`,
    });
  else if (status === 'COMPLETED' && record.pointCount === 0)
    banners.indexing.push({
      key: 'nothing',
      tone: 'warning',
      header: 'Nothing was indexed',
      children: `The ${noun} was read, but no searchable text came out of it. Index it again to retry.`,
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
      children: `A summary, category and topics appear here once the ${noun} has been analyzed.`,
    });
  else if (record.classifyStatus === 'skipped' || record.classifyStatus === 'failed')
    banners.content.push({
      key: 'none',
      tone: record.classifyStatus === 'failed' ? 'error' : 'info',
      header: record.classifyStatus === 'failed' ? 'Summary failed' : 'Not summarized',
      children: `${classify?.reason ?? `No summary was made for this ${noun}.`} Search still covers its full text.`,
      ...(record.classifyStatus === 'failed' ? { action: indexAgain } : {}),
    });

  return banners;
}

// Every banner the page can show, in the cards it shows them in (for a look at them all).
export function sampleBanners(actions: BannerActions): Banners {
  const button = (text: string) => <Button onClick={() => undefined}>{text}</Button>;
  return {
    page: [
      {
        key: 'busy',
        tone: 'progress',
        solid: true,
        header: 'Indexing in progress',
        children:
          'This email is being read and indexed. It appears in search results once indexing completes.',
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
        children: 'This file was replaced 2 times. Only the latest version is searched.',
      },
    ],
    indexing: [
      {
        key: 'failed',
        tone: 'error',
        header: 'Indexing failed',
        children: 'Larger than 100 MB, so it wasn’t read. It isn’t included in search results.',
        action: button('Index again'),
      },
      {
        key: 'locked',
        tone: 'warning',
        header: 'Password protected',
        children:
          'This file is encrypted, so its text can’t be read. Remove the password and upload it again to make it searchable.',
      },
      {
        key: 'empty',
        tone: 'info',
        header: 'No text found',
        children: 'This email has no readable text, so it doesn’t appear in search results.',
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
        children: 'A summary, category and topics appear here once the email has been analyzed.',
      },
      {
        key: 'none',
        tone: 'error',
        header: 'Summary failed',
        children: 'The model didn’t respond in time. Search still covers its full text.',
        action: button('Index again'),
      },
      {
        key: 'success',
        tone: 'success',
        header: 'Summary ready',
        children: 'Summarized, categorized and tagged with topics.',
      },
    ],
  };
}
