import { describe, expect, it } from "vitest";
import { shouldPersistQuery } from "@/lib/query-persistence";

describe("query persistence", () => {
  it("persists successful light queries", () => {
    expect(shouldPersistQuery({ state: { status: "success" } })).toBe(true);
  });
  it("excludes complete documents and photos from the duplicate query cache", () => {
    expect(shouldPersistQuery({ state: { status: "success" }, meta: { heavy: true } })).toBe(false);
  });
  it.each(["pending", "error"])("does not persist %s queries", (status) => {
    expect(shouldPersistQuery({ state: { status } })).toBe(false);
  });
});