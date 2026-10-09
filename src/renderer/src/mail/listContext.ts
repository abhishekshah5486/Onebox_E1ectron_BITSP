// The list a conversation was opened from, so the reading view can show "3 of 120" and step to
// the next and previous conversation, like Gmail.
interface ListContext {
  basePath: string;
  ids: string[];
  offset: number;
  total: number | null;
}

let current: ListContext | null = null;

export function rememberList(context: ListContext) {
  current = context;
}

export function positionIn(basePath: string, id: string) {
  if (!current || current.basePath !== basePath) return null;
  const index = current.ids.indexOf(id);
  if (index < 0) return null;
  return {
    position: current.offset + index + 1,
    total: current.total,
    newer: current.ids[index - 1] ?? null,
    older: current.ids[index + 1] ?? null,
  };
}
