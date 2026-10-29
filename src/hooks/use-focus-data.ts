import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

/** Loads data whenever the screen gains focus, so tabs stay in sync with storage. */
export function useFocusData<T>(load: () => Promise<T>, initial: T) {
  const [data, setData] = useState<T>(initial);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    setData(await load());
    setLoaded(true);
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  return { data, loaded, reload, setData };
}
