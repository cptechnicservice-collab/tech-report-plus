import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ read: vi.fn(), write: vi.fn(), queue: vi.fn() }));
vi.mock("@/lib/offline.cache", () => ({ readCached: mocks.read, writeCached: mocks.write }));
vi.mock("@/lib/offline.queue", () => ({ getQueueItems: mocks.queue }));
import { mergeListCache } from "@/lib/list-cache";

describe("light lists preserve complete offline records", () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.queue.mockResolvedValue([]); });
  it("retains photos and snapshots while updating scalar totals", async () => {
    mocks.read.mockResolvedValue([{ id: "report", total_geral: 100, pecas_snapshot: [{ foto_data_url: "data:image/png;base64,PHOTO" }] }]);
    await mergeListCache("reports", "relatorios_salvos", [{ id: "report", total_geral: 200 }]);
    expect(mocks.write).toHaveBeenCalledWith("reports", [{ id: "report", total_geral: 200, pecas_snapshot: [{ foto_data_url: "data:image/png;base64,PHOTO" }] }]);
  });
  it("does not replace pending edits or restore a pending deletion", async () => {
    mocks.read.mockResolvedValue([{ id: "edited", total_geral: 300 }]);
    mocks.queue.mockResolvedValue([{ entity: "relatorios_salvos", recordId: "edited", action: "upsert" }, { entity: "relatorios_salvos", recordId: "deleted", action: "delete" }]);
    expect(await mergeListCache("reports", "relatorios_salvos", [{ id: "edited", total_geral: 100 }, { id: "deleted", total_geral: 100 }])).toEqual([{ id: "edited", total_geral: 300 }]);
  });
});