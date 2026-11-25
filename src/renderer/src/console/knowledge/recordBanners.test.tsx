import { describe, expect, it } from 'vitest';
import type { HubNode, RecordDetails } from '../../api/hub';
import { recordBanners } from './recordBanners';

const actions = {
  restore: () => undefined,
  indexAgain: () => undefined,
  summarizeAgain: () => undefined,
  open: () => undefined,
  toggleProblems: () => undefined,
  problemsOnly: false,
};

const record = (overrides: Partial<RecordDetails> = {}) =>
  ({
    id: 'e1',
    name: 'Quarter pack',
    recordType: 'MAIL',
    status: 'completed',
    reason: null,
    version: 1,
    pointCount: 4,
    classifyStatus: 'completed',
    deletedAt: null,
    ...overrides,
  }) as RecordDetails;

const file = (indexingStatus: string) => ({ id: indexingStatus, indexingStatus }) as HubNode;
const now = Date.parse('2026-11-26T00:00:00Z');
const headers = (list: { header?: unknown }[]) => list.map((b) => b.header);

describe('a record page’s banners', () => {
  it('shows none for an indexed email', () => {
    const banners = recordBanners(record(), [file('COMPLETED')], 14, actions, now);
    expect(Object.values(banners).flat()).toEqual([]);
  });

  it('says who deleted it, and when it goes for good', () => {
    const deletedAt = '2026-11-21T00:00:00Z';
    const mine = recordBanners(record({ deletedAt, deleteSource: 'user' }), [], 14, actions, now);
    expect(mine.page[0]).toMatchObject({
      tone: 'warning',
      header: 'You moved this email to Recently deleted',
    });
    expect(mine.page[0]!.children).toContain('9 days');
    const mailbox = recordBanners(
      record({ deletedAt, deleteSource: 'source' }),
      [],
      14,
      actions,
      now,
    );
    expect(mailbox.page[0]).toMatchObject({
      tone: 'burgundy',
      header: 'Deleted from your mailbox',
    });
  });

  it('puts each problem in its card', () => {
    const banners = recordBanners(
      record({ status: 'failed', reason: 'Larger than 100 MB.', classifyStatus: 'queued' }),
      [file('FAILED'), file('COMPLETED'), file('QUEUED')],
      14,
      actions,
      now,
    );
    expect(headers(banners.indexing)).toEqual(['Indexing failed']);
    expect(headers(banners.attachments)).toEqual([
      '1 of 3 attachments wasn’t indexed',
      'Indexing 1 attachment',
    ]);
    expect(headers(banners.content)).toEqual(['Summary pending']);
  });

  it('offers to make only the summary again once the record is indexed', () => {
    const failed = { classifyStatus: 'failed' as const };
    const indexed = recordBanners(record(failed), [], 14, actions, now).content[0]!;
    expect((indexed.action as { props: { children: string } }).props.children).toBe(
      'Summarize again',
    );
    const reading = recordBanners(
      record({ ...failed, status: 'in_progress' }),
      [],
      14,
      actions,
      now,
    );
    expect(reading.content[0]!.action).toBeUndefined();
  });
});
