// The desktop app (its preload adds window.onebox) sends links to the system browser.
const isDesktop = () => 'onebox' in window;

// Opens a provider's page (checkout, billing) in a new tab; false when the browser blocked it,
// as it can once the click that asked for it is a few seconds old.
export function openInBrowser(url: string) {
  if (isDesktop()) {
    window.open(url, '_blank');
    return true;
  }
  const tab = window.open(url, '_blank');
  if (!tab) return false;
  tab.opener = null;
  return true;
}
