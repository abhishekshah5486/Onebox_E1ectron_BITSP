import { useEffect, useRef, useState } from 'react';

// No allow-scripts: the email can never run code. allow-same-origin only lets us measure height.
const SANDBOX = 'allow-same-origin allow-popups allow-popups-to-escape-sandbox';

export function buildSrcDoc(html: string, allowRemoteImages: boolean): string {
  const imgSrc = allowRemoteImages ? 'https: data:' : 'data:';
  return [
    '<!doctype html><html><head><meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${imgSrc}; style-src 'unsafe-inline'; font-src data:">`,
    '<base target="_blank">',
    '<style>body{margin:0;padding:4px;font:14px/1.5 Arial,Helvetica,sans-serif;color:#202124;background:#fff;overflow-wrap:anywhere}img{max-width:100%;height:auto}table{max-width:100%}</style>',
    `</head><body>${html}</body></html>`,
  ].join('');
}

export function EmailFrame({
  html,
  allowRemoteImages,
}: {
  html: string;
  allowRemoteImages: boolean;
}) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(120);

  useEffect(() => {
    const frame = ref.current;
    if (!frame) return;
    let observer: ResizeObserver | undefined;
    const measure = () => {
      const doc = frame.contentDocument;
      if (!doc?.body) return;
      setHeight(Math.max(60, doc.documentElement.scrollHeight));
      observer?.disconnect();
      observer = new ResizeObserver(() =>
        setHeight(Math.max(60, doc.documentElement.scrollHeight)),
      );
      observer.observe(doc.body);
    };
    frame.addEventListener('load', measure);
    return () => {
      frame.removeEventListener('load', measure);
      observer?.disconnect();
    };
  }, [html, allowRemoteImages]);

  return (
    <iframe
      ref={ref}
      title="Email content"
      sandbox={SANDBOX}
      srcDoc={buildSrcDoc(html, allowRemoteImages)}
      style={{ width: '100%', height, border: 0, borderRadius: 8, background: '#fff' }}
    />
  );
}
