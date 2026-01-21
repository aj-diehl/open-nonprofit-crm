import { vi } from "vitest";

export const redirectMock = vi.fn();
export const revalidatePathMock = vi.fn();
export const nextResponseRedirectMock = vi.fn((url: URL) => ({ url }));
