import { defaultShouldDehydrateQuery, type Query } from "@tanstack/react-query";

/** Complete documents/photos already have the user-scoped offline cache. */
export function shouldPersistQuery(query: Query) {
  if (query.meta?.["heavy"] === true) return false;
  return defaultShouldDehydrateQuery(query);
}