import { exercisesApi } from '../api/services';
import { useFetch } from './useFetch';

/** Loads the exercise catalog for <select> inputs (up to 100, the API page limit). */
export function useExerciseOptions() {
  const { data, loading, error } = useFetch(() => exercisesApi.list({ limit: 100 }).then((page) => page.items), []);
  return { exercises: data ?? [], loading, error };
}
