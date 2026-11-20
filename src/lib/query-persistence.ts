/** Complete documents/photos already have the user-scoped offline cache. */
export function shouldPersistQuery(query: {
  meta?: Record<string, unknown> | undefined;
  state: { status: string };
}) {
  if (query.meta?.["heavy"] === true) return false;
  return query.state.status === "success";
}