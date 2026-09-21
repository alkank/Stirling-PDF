import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useLegacySubscriptions } from "@app/hooks/useLegacySubscriptions";
import type { LegacySubscription } from "@app/types/legacyBilling";

let user: { id: string; is_anonymous?: boolean } | null;
let authLoading = false;
const fetchSubscriptions = vi.fn();
const portal = vi.fn();
const navigate = vi.fn();
vi.mock("@app/auth/UseSession", () => ({
  useAuth: () => ({ user, loading: authLoading }),
}));
vi.mock("@app/services/legacyBilling", () => ({
  fetchLegacySubscriptions: (...args: unknown[]) => fetchSubscriptions(...args),
  createLegacyPortalSession: () => portal(),
}));
vi.mock("@app/platform/openExternal", () => ({
  openExternal: (...args: unknown[]) => navigate(...args),
}));
const subscription: LegacySubscription = {
  id: "sub_1",
  plan: "pro",
  status: "active",
  currentPeriodEnd: null,
  teamId: null,
  teamAllowance: null,
};

describe("legacy billing ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    user = { id: "owner" };
    authLoading = false;
    fetchSubscriptions.mockResolvedValue([subscription]);
    portal.mockResolvedValue("https://billing.stripe.com/p/session/test");
  });

  it("waits for authentication before deciding that the account has no subscription", () => {
    user = null;
    authLoading = true;
    const { result } = renderHook(() => useLegacySubscriptions());
    expect(result.current.loading).toBe(true);
    expect(fetchSubscriptions).not.toHaveBeenCalled();
  });

  it("does not query billing or mint a portal for anonymous users", async () => {
    user = { id: "guest", is_anonymous: true };
    const { result } = renderHook(() => useLegacySubscriptions());
    await act(() => result.current.openPortal());
    expect(fetchSubscriptions).not.toHaveBeenCalled();
    expect(portal).not.toHaveBeenCalled();
  });

  it("discards the previous owner's records when accounts change during a request", async () => {
    let resolveOwner!: (value: LegacySubscription[]) => void;
    fetchSubscriptions.mockImplementationOnce(
      () =>
        new Promise<LegacySubscription[]>((resolve) => {
          resolveOwner = resolve;
        }),
    );
    const { result, rerender } = renderHook(() => useLegacySubscriptions());
    user = { id: "other" };
    fetchSubscriptions.mockResolvedValue([]);
    rerender();
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => resolveOwner([subscription]));
    expect(result.current.subscriptions).toEqual([]);
    await act(() => result.current.openPortal());
    expect(portal).not.toHaveBeenCalled();
  });

  it("refreshes after returning from Stripe and removes ended subscriptions", async () => {
    const { result } = renderHook(() => useLegacySubscriptions());
    await waitFor(() =>
      expect(result.current.subscriptions).toEqual([subscription]),
    );
    await act(() => result.current.openPortal());
    expect(navigate).toHaveBeenCalledWith(
      "https://billing.stripe.com/p/session/test",
    );
    fetchSubscriptions.mockResolvedValue([]);
    act(() => window.dispatchEvent(new Event("focus")));
    await waitFor(() => expect(result.current.subscriptions).toEqual([]));
  });

  it("exposes a retryable lookup failure without claiming the owner has a free plan", async () => {
    fetchSubscriptions.mockRejectedValueOnce(new Error("Offline"));
    const { result } = renderHook(() => useLegacySubscriptions());
    await waitFor(() => expect(result.current.loadError).toBe(true));
    fetchSubscriptions.mockResolvedValue([subscription]);
    act(() => result.current.refresh());
    await waitFor(() =>
      expect(result.current.subscriptions).toEqual([subscription]),
    );
    expect(result.current.loadError).toBe(false);
    portal.mockRejectedValueOnce(new Error("Stripe unavailable"));
    await act(() => result.current.openPortal());
    expect(result.current.portalError).toBe(true);
    expect(navigate).not.toHaveBeenCalled();
  });
});
