import { useEffect, useRef } from 'react';
import { Navigate, useParams } from 'react-router';
import { composeApi } from '../api/compose';
import { useAuth } from '../auth/AuthProvider';
import { useCompose } from './ComposeProvider';

// v1 has no compose page: /compose (or /compose/<draft>) opens a window over the inbox.
export function OpenCompose() {
  const { api } = useAuth();
  const { draftId } = useParams();
  const { open } = useCompose();
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    if (!draftId) return open();
    void composeApi
      .draft(api, draftId)
      .then((draft) => open({ composition: draft, draftId: draft.id }))
      .catch(() => open());
  }, [api, draftId, open]);
  return <Navigate to="/inbox" replace />;
}
