import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { feedbackApi } from '../api/services';
import { useAuth } from './AuthContext';

interface UnreadFeedback {
  count: number;
  refresh: () => void;
}

const Ctx = createContext<UnreadFeedback>({ count: 0, refresh: () => undefined });

/**
 * Unread trainer-feedback count for the member navigation badge. Uses the
 * X-Unread-Count header of GET /trainer-feedback (limit=1) — no extra
 * endpoint. Refreshed on navigation and after marking feedback as read.
 */
export function UnreadFeedbackProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  const [count, setCount] = useState(0);

  const refresh = useCallback(() => {
    if (user?.role !== 'Member') return;
    feedbackApi
      .list({ unread: true, limit: 1 })
      .then((page) => setCount(page.unread ?? 0))
      .catch(() => undefined); // the badge is a convenience; errors show on the page itself
  }, [user?.role]);

  useEffect(refresh, [refresh, location.pathname]);

  return <Ctx.Provider value={{ count, refresh }}>{children}</Ctx.Provider>;
}

export const useUnreadFeedback = () => useContext(Ctx);
