import Button from '@cloudscape-design/components/button';
import Header from '@cloudscape-design/components/header';
import Link from '@cloudscape-design/components/link';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Table from '@cloudscape-design/components/table';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { composeApi, composeKeys, useDrafts, type Draft } from '../api/compose';
import { useAuth } from '../auth/AuthProvider';
import { useCompose } from '../compose/ComposeProvider';
import { draftRecipients } from '../compose/DraftRows';
import { formatListDate } from '../mail/format';
import { useNotify } from '../ui/useNotify';

// v2's drafts saved in OneBox: a console table above the Drafts folder's mail.
export function ConsoleDrafts({ accountId }: { accountId?: string }) {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const compose = useCompose();
  const notify = useNotify();
  const [selected, setSelected] = useState<Draft[]>([]);
  const drafts = (useDrafts().data ?? []).filter(
    (draft) => !accountId || draft.accountId === accountId,
  );
  if (drafts.length === 0) return null;
  const open = (draft: Draft) => compose.open({ composition: draft, draftId: draft.id });

  const discard = async () => {
    await Promise.all(selected.map((draft) => composeApi.deleteDraft(api, draft.id)));
    await queryClient.invalidateQueries({ queryKey: composeKeys.drafts });
    notify({
      type: 'info',
      tone: 'burgundy',
      content: selected.length === 1 ? 'Draft discarded.' : `${selected.length} drafts discarded.`,
    });
    setSelected([]);
  };

  return (
    <Table
      variant="container"
      trackBy="id"
      items={drafts}
      selectionType="multi"
      selectedItems={selected}
      onSelectionChange={({ detail }) => setSelected(detail.selectedItems)}
      ariaLabels={{
        selectionGroupLabel: 'Drafts',
        itemSelectionLabel: (_, draft) => draft.subject || '(no subject)',
        allItemsSelectionLabel: () => 'All drafts',
      }}
      header={
        <Header
          variant="h2"
          counter={`(${drafts.length})`}
          description="Saved as you wrote them. Open one to carry on."
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button disabled={selected.length === 0} onClick={() => void discard()}>
                Discard
              </Button>
              <Button disabled={selected.length !== 1} onClick={() => open(selected[0]!)}>
                Continue writing
              </Button>
            </SpaceBetween>
          }
        >
          Drafts in OneBox
        </Header>
      }
      columnDefinitions={[
        {
          id: 'to',
          header: 'To',
          cell: (draft) => draftRecipients(draft) || '(no recipients)',
        },
        {
          id: 'subject',
          header: 'Subject',
          cell: (draft) => (
            <Link
              onFollow={(event) => {
                event.preventDefault();
                open(draft);
              }}
            >
              {draft.subject || '(no subject)'}
            </Link>
          ),
        },
        {
          id: 'edited',
          header: 'Last edited',
          cell: (draft) => formatListDate(draft.updatedAt),
        },
      ]}
    />
  );
}
