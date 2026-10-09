import { useOptionalFlash, type FlashInput } from '../settings/flash';
import { useSnackbar } from './Snackbar';

export type Notice = FlashInput & { header?: string; content: string };

// Tells the person something in the interface's own way: a banner in the console (v2), the
// snackbar elsewhere (v1). Plain text, so both can show it.
export function useNotify() {
  const flash = useOptionalFlash();
  const snackbar = useSnackbar();
  return (notice: Notice) => {
    if (flash) return flash(notice);
    snackbar({
      text: [notice.header, notice.content].filter(Boolean).join(' '),
      ...(notice.action && { action: notice.action }),
    });
  };
}
