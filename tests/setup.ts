import { vi } from "vitest";

// Pure calculation tests must never initialize authentication or contact real data.
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));