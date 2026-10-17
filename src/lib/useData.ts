import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { getSettings, getTasks, DEFAULT_SETTINGS } from './storage';
import type { Settings, Task } from './types';

// Reloads tasks and settings every time a screen comes into view
export function useData() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const reload = useCallback(async () => {
    const [t, s] = await Promise.all([getTasks(), getSettings()]);
    setTasks(t);
    setSettings(s);
  }, []);
  useFocusEffect(useCallback(() => { reload(); }, [reload]));
  return { tasks, settings, setTasks, reload };
}
