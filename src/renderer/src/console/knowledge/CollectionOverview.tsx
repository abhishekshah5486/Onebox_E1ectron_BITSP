import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import ExpandableSection from '@cloudscape-design/components/expandable-section';
import KeyValuePairs from '@cloudscape-design/components/key-value-pairs';
import ProgressBar from '@cloudscape-design/components/progress-bar';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import { useState } from 'react';
import { hubApi, useCollectionStats, useHubMutation } from '../../api/hub';
import { formatSize } from '../../knowledge/format';
import { useFlash } from '../../settings/flash';
import { ConfirmModal } from './dialogs';
import { STATUS, STATUS_ORDER, problem } from './parts';

// How a collection's records stand, with a way to read the failed ones again.
export function CollectionOverview({ id }: { id: string }) {
  const flash = useFlash();
  const stats = useCollectionStats(id);
  const [asking, setAsking] = useState(false);
  const reindex = useHubMutation((a, statuses: string[]) =>
    hubApi.reindexCollection(a, id, { statuses }),
  );
  const s = stats.data;
  if (!s || s.total === 0) return null;
  const done = s.statuses.COMPLETED ?? 0;
  const failed = s.statuses.FAILED ?? 0;
  const summarized = s.summaries.COMPLETED ?? 0;

  return (
    <ExpandableSection variant="container" headerText="Overview" defaultExpanded={failed > 0}>
      <KeyValuePairs
        columns={4}
        items={[
          { label: 'Records', value: s.total },
          { label: 'Size', value: formatSize(s.sizeBytes) },
          {
            label: 'Indexed',
            value: (
              <ProgressBar
                value={(done / s.total) * 100}
                additionalInfo={`${done} of ${s.total}`}
              />
            ),
          },
          {
            label: 'Summarized',
            value: (
              <ProgressBar
                value={(summarized / s.total) * 100}
                additionalInfo={`${summarized} of ${s.total}`}
              />
            ),
          },
          ...STATUS_ORDER.filter((k) => s.statuses[k]).map((k) => ({
            label: STATUS[k].label,
            value: <StatusIndicator type={STATUS[k].type}>{s.statuses[k]}</StatusIndicator>,
          })),
        ]}
      />
      {failed > 0 && (
        <Box margin={{ top: 'm' }}>
          <Button loading={reindex.isPending} onClick={() => setAsking(true)}>
            Index failed files again
          </Button>
        </Box>
      )}
      {asking && (
        <ConfirmModal
          title="Index failed files again"
          confirm="Index again"
          danger={false}
          onConfirm={async () => {
            try {
              const r = await reindex.mutateAsync(['FAILED']);
              flash({ type: 'success', content: `${r.queued.length} queued to be indexed again.` });
            } catch (err) {
              flash({ type: 'error', content: problem(err, 'Nothing was queued.') });
            }
          }}
          onClose={() => setAsking(false)}
        >
          <Box variant="p">
            Index the {failed} failed {failed === 1 ? 'file' : 'files'} again from the start? This
            can take a while for large files.
          </Box>
        </ConfirmModal>
      )}
    </ExpandableSection>
  );
}
