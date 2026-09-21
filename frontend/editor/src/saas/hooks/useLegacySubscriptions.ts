import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@app/auth/UseSession";
import { openExternal } from "@app/platform/openExternal";
import {
  createLegacyPortalSession,
  fetchLegacySubscriptions,
} from "@app/services/legacyBilling";
import type {
  LegacyBillingState,
  LegacySubscription,
} from "@app/types/legacyBilling";

/** Keeps historical billing separate from wallet allowances and current team membership. */
export function useLegacySubscriptions(): LegacyBillingState {
  const { user, loading: authLoading } = useAuth();
  const userId = user && !user.is_anonymous ? user.id : null;
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{
    userId: string;
    subscriptions: LegacySubscription[];
    loadError: boolean;
  } | null>(null);
  const [opening, setOpening] = useState(false);
  const [portalError, setPortalError] = useState(false);
  const currentUser = useRef(userId);
  currentUser.current = userId;
  const refresh = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [refresh]);

  useEffect(() => {
    let cancelled = false;
    setResult(null);
    setPortalError(false);
    if (userId) {
      void fetchLegacySubscriptions(userId).then(
        (subscriptions) => {
          if (!cancelled)
            setResult({ userId, subscriptions, loadError: false });
        },
        () => {
          if (!cancelled)
            setResult({ userId, subscriptions: [], loadError: true });
        },
      );
    }
    return () => {
      cancelled = true;
    };
  }, [userId, revision]);

  const subscriptions =
    result?.userId === userId ? (result?.subscriptions ?? []) : [];
  const openPortal = async () => {
    if (!userId || !subscriptions.length || opening) return;
    setOpening(true);
    setPortalError(false);
    try {
      const url = await createLegacyPortalSession();
      if (currentUser.current === userId) await openExternal(url);
    } catch {
      if (currentUser.current === userId) setPortalError(true);
    } finally {
      setOpening(false);
    }
  };

  return {
    subscriptions,
    loading: authLoading || Boolean(userId && result?.userId !== userId),
    loadError: result?.userId === userId && Boolean(result?.loadError),
    opening,
    portalError,
    refresh,
    openPortal,
  };
}
