export type StepStatus = 'done' | 'current' | 'waiting';

/** "I measured a new sweep": confirm, then load; steps 3–5 open together once a sweep is loaded (spec §8.1). */
export function newSweepStatus(confirmed: boolean, loaded: boolean): StepStatus[] {
  if (!confirmed) return ['current', 'waiting', 'waiting', 'waiting', 'waiting'];
  if (!loaded) return ['done', 'current', 'waiting', 'waiting', 'waiting'];
  return ['done', 'done', 'current', 'current', 'current'];
}

/** "Try a change first": pick a part, change it; the before/after result opens once something changed (spec §8.2). */
export function tryChangeStatus(picked: boolean, changed: boolean): StepStatus[] {
  if (changed) return ['done', 'done', 'current'];
  return picked ? ['done', 'current', 'waiting'] : ['current', 'waiting', 'waiting'];
}
