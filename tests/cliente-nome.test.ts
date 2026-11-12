import { beforeEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({ readCached: vi.fn(), writeCached: vi.fn(), enqueue: vi.fn(), isOffline: vi.fn(), from: vi.fn(), upsert: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));
vi.mock("@/lib/offline.cache", () => ({ readCached: mocks.readCached, writeCached: mocks.writeCached }));
vi.mock("@/lib/offline.queue", () => ({ enqueue: mocks.enqueue, requireUserId: async () => "test-user" }));
vi.mock("@/lib/offline.utils", () => ({ isOffline: mocks.isOffline, isNetworkError: () => false, timeoutSignal: () => AbortSignal.timeout(1000) }));
import { saveClienteOffline } from "@/lib/offline.records";

beforeEach(() => { vi.clearAllMocks(); });

test.each([true, false])("nomes ficam em maiúsculas no salvamento e cache; offline=%s", async (offline) => {
  mocks.readCached.mockResolvedValue([]);
  mocks.isOffline.mockReturnValue(offline);
  mocks.from.mockReturnValue({ upsert: mocks.upsert });
  mocks.upsert.mockReturnValue({ abortSignal: async () => ({ error: null }) });
  const result = await saveClienteOffline({
    id: "cliente-test", nome: "João e Máquinas Ltda", cidade: "São Paulo", cnpj: null,
    contato: null, telefone: null, ativo: true, observacoes: null,
  });
  const stored = offline ? mocks.enqueue.mock.calls[0]?.[0]?.payload : mocks.upsert.mock.calls[0]?.[0];
  expect(stored.nome).toBe("JOÃO E MÁQUINAS LTDA");
  expect(result.cliente.nome).toBe("JOÃO E MÁQUINAS LTDA");
  expect(mocks.writeCached.mock.calls[0]?.[1]?.[0]?.nome).toBe("JOÃO E MÁQUINAS LTDA");
  expect(stored.cidade).toBe("São Paulo");
});