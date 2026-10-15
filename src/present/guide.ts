export type StepStatus = 'done' | 'current' | 'waiting';

/** "I measured a new sweep": confirm, then load; steps 3–5 open together once a sweep is loaded (spec §8.1). */
export function newSweepStatus(confirmed: boolean, loaded: boolean): StepStatus[] {
  if (!confirmed) return ['current', 'waiting', 'waiting', 'waiting', 'waiting'];
  if (!loaded) return ['done', 'current', 'waiting', 'waiting', 'waiting'];
  return ['done', 'done', 'current', 'current', 'current'];
}
