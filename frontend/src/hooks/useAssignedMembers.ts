import { assignmentsApi } from '../api/services';
import type { User } from '../api/types';
import { useFetch } from './useFetch';

/** For trainers: the members assigned to them (GET /trainer-assignments is scoped by the API). */
export function useAssignedMembers() {
  const { data, loading, error, reload } = useFetch(() => assignmentsApi.list({ limit: 100 }), []);
  const members: User[] = (data?.items ?? []).map((a) => a.member!).filter(Boolean);
  return { members, loading, error, reload };
}
