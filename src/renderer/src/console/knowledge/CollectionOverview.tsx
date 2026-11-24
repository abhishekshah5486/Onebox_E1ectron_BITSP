import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import ExpandableSection from '@cloudscape-design/components/expandable-section';
import KeyValuePairs from '@cloudscape-design/components/key-value-pairs';
import ProgressBar from '@cloudscape-design/components/progress-bar';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import { hubApi, useCollectionStats, useHubMutation } from '../../api/hub';
import { formatSize } from '../../knowledge/format';
import { useFlash } from '../../settings/flash';
import { STATUS, STATUS_ORDER, problem } from './parts';

// How a collection's records stand, with a way to read the failed ones again.
export function CollectionOverview({ id }: { id: string }) {
  const flash = useFlash();
  const stats = useCollectionStats(id);
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
          <Button
            loading={reindex.isPending}
            onClick={() =>
              reindex.mutate(['FAILED'], {
                onSuccess: (r) =>
                  flash({
                    type: 'success',
                    content: `${r.queued.length} queued to be read again.`,
                  }),
                onError: (err) =>
                  flash({ type: 'error', content: problem(err, 'Nothing was queued.') }),
              })
            }
          >
            Read failed files again
          </Button>
        </Box>
      )}
    </ExpandableSection>
  );
}
