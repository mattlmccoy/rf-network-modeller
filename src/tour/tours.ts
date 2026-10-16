import { allBlocks } from '../chain/state.ts';
import type { AppState } from '../app/state.ts';
import type { Level } from '../present/level.ts';
import type { Task } from '../ui/Home.tsx';

export type TourId = 'newSweep' | 'tryChange' | 'safePower' | 'newNetwork' | 'pastBuilds' | 'rigHistory';
/** What a step's completion is judged on: the app now, the app when the step began, the open task and the level. */
export interface StepCtx { state: AppState; atStep: AppState; task: Task; level: Level }
export type Advance = { kind: 'next' } | { kind: 'click' } | { kind: 'state'; done: (c: StepCtx) => boolean };
export type PerLevel<T> = T | { beginner?: T; builder?: T; engineer?: T };
export interface Step { id: string; title: string; text: PerLevel<string>; target: PerLevel<string | null>; advance: Advance; levels?: readonly Level[] }
export interface Tour { id: TourId; task: Task; title: string; minutes: number; blurb: string; levels: readonly Level[]; steps: readonly Step[] }

const ALL: readonly Level[] = ['beginner', 'builder', 'engineer'];
const ABOVE: readonly Level[] = ['builder', 'engineer'];
const ids = (s: AppState): string[] => allBlocks(s.chain.blocks).map((b) => b.id);
const next: Advance = { kind: 'next' };
const click: Advance = { kind: 'click' };
const when = (done: (c: StepCtx) => boolean): Advance => ({ kind: 'state', done });
const open = (task: Task, title: string, text: string): Step => ({ id: 'open', title, text, target: `tile-${task}`, advance: when((c) => c.task === task) });
const DRAWING = { beginner: 'power-flow drawing', builder: 'hardware drawing', engineer: 'schematic' } as const;

/** The tours, one per Home task (spec §5). Text says where to look, never a number. */
export const TOURS: readonly Tour[] = [
  {
    id: 'newSweep', task: 'newSweep', title: 'I measured a new sweep', minutes: 3, levels: ALL,
    blurb: 'Load a sweep, read what it says, and find the next change to make.',
    steps: [
      open('newSweep', 'Open the task', 'Click “I measured a new sweep”. This is the task to use after every VNA sweep.'),
      { id: 'confirm', title: 'Say what is installed', target: 'confirm', advance: click,
        text: 'Step 1 lists the capacitors and the sense loop the app thinks are on the board. If that matches the bench, click “That’s what’s installed”. If not, “Change” lets you fix it first.' },
      { id: 'load', title: 'Load the sweep', target: 'use-sweep', advance: click,
        text: 'Normally you choose the .s1p file the VNA saved. This practice project already has one loaded, so click “Use … (already loaded)”.' },
      { id: 'verdict', title: 'Read the result', advance: next,
        target: { beginner: 'verdict-card', builder: 'target-box', engineer: 'plots' },
        text: {
          beginner: 'The card says in plain words whether the build sits in the tuner’s good range and how much room it has as the part warms. The small line on top says whether that comes from your sweep or from the model.',
          builder: 'The box is the tuner’s good range. Your sweep is the filled dot and the model is the ring. The line under it says whether it lands in range and how much room is left to drift.',
          engineer: 'The plots show the measured trace (dashed) and the model for each cable assumption. Dots mark 13.56 MHz and the shaded patch is the tuner’s good range. The table under them gives the impedance and the room for each.',
        } },
      { id: 'power', title: 'Check the power line', target: 'power-line', advance: next,
        text: 'The line under the verdict checks every capacitor at the planned power. If one would go over its rating, it names the part and the power that keeps it safe.' },
      { id: 'agree', title: 'Does the model agree?', target: 'agree', advance: next,
        text: {
          beginner: 'Step 3 says whether the model matches your sweep. If it does not, refit before trusting the suggestions.',
          builder: 'Step 3 compares the model with your sweep. If it is off, “Refit” fits the model to your sweeps; a warning appears when the sweeps cannot pin the values down, and you can put the old fit back.',
        } },
      { id: 'changes', title: 'What to change', target: 'changes', advance: next,
        text: 'Step 4 lists capacitor changes you can make from your parts on hand, ranked by the model. “Show on drawing” previews one; “Use this” sets the circuit to it so you can build it and sweep again. When nothing in stock helps, it says what limits you.' },
      { id: 'safe', title: 'Safe at full power?', target: 'to-safe', advance: click,
        text: 'Last, “Check it at full power” opens the power check for this build. It has its own tour. Click it to finish this one.' },
    ],
  },
  {
    id: 'tryChange', task: 'tryChange', title: 'Try a change first', minutes: 2, levels: ALL,
    blurb: 'Change a part and see what the VNA would show, before touching the board.',
    steps: [
      open('tryChange', 'Open the task', 'Click “Try a change first”. Use it to check a change before you build it.'),
      { id: 'pick', title: 'Pick a part', target: 'part-sh', advance: when((c) => c.state.selected === 'sh' && c.atStep.selected !== 'sh'),
        text: {
          beginner: 'In the power-flow drawing the matching box is open. Click the “Shunt bank” chip.',
          builder: `Click the shunt bank in the ${DRAWING.builder}.`,
          engineer: `Click the shunt bank in the ${DRAWING.engineer}.`,
        } },
      { id: 'change', title: 'Change it', target: 'part-editor', advance: when((c) => c.state.chain !== c.atStep.chain),
        text: 'The part editor opens beside the drawing (below it on a phone). Change one of the part counts, for example add a 100 pF part.' },
      { id: 'compare', title: 'Before and now', target: 'what-it-does', advance: next,
        text: {
          beginner: 'The guide shows what the model said before the change and what it says now.',
          builder: 'The guide shows the model before the change and now. In the target box the dashed ring marks where it was before.',
          engineer: 'The guide shows before and now, and the plots and table update for the new circuit.',
        } },
      { id: 'keep', title: 'Keep or undo', target: 'keep', advance: next,
        text: '“Keep this change” keeps it; “Undo” puts it back. Leaving this task without Keep also puts the circuit back, so nothing changes by accident.' },
    ],
  },
  {
    id: 'safePower', task: 'safePower', title: 'Safe at full power?', minutes: 2, levels: ALL,
    blurb: 'Check the capacitors, and the transformer, at the power you plan to run.',
    steps: [
      open('safePower', 'Open the task', 'Click “Safe at full power?”. It checks the parts at the power you plan to run.'),
      { id: 'power', title: 'Planned power', target: 'power-input', advance: when((c) => c.state.powerW !== c.atStep.powerW),
        text: 'Type the power you plan to run, for example 300, and press Enter.' },
      { id: 'caps', title: 'The capacitors', target: 'cap-line', advance: next,
        text: 'This line checks every capacitor against its voltage and current rating at that power, and gives the power that keeps them all within rating. Grey means it cannot tell, or that the numbers are only an estimate.' },
      { id: 'table', title: 'Each part', target: 'cap-table', advance: next, levels: ABOVE,
        text: 'The table gives each capacitor’s share of its rating. The bar turns red at 100 %.' },
      { id: 'flux', title: 'The transformer', target: 'transformer', advance: next, levels: ABOVE,
        text: 'Transformer flux is a range, because one sweep cannot tell how the leakage splits between the windings. If it asks for a transformer model, the button fits one from the measured part’s sweep in a few seconds.' },
    ],
  },
  {
    id: 'newNetwork', task: 'newNetwork', title: 'Start a new network', minutes: 3, levels: ALL,
    blurb: 'Start the next build from a template, then add, move and remove parts.',
    steps: [
      open('newNetwork', 'Open the task', 'Click “Start a new network”. Use it to plan the next build.'),
      { id: 'template', title: 'Pick a starting point', target: 'tpl-copy', advance: click,
        text: 'Click “A copy of this project’s circuit”. It keeps the fitted values but none of the sweeps. Templates start a new project; here in practice nothing is saved.' },
      { id: 'select', title: 'Select a part', target: 'drawing', advance: when((c) => c.state.selected !== null && c.state.selected !== c.atStep.selected),
        text: {
          beginner: 'Click a part in the power-flow drawing, for example a chip in the matching box.',
          builder: `Click a part in the ${DRAWING.builder}, for example the wiring inductance.`,
          engineer: `Click a part in the ${DRAWING.engineer}, for example the wiring inductance.`,
        } },
      { id: 'add', title: 'Add a part', target: 'add-part', advance: when((c) => ids(c.state).length > ids(c.atStep).length),
        text: 'Choose a part and where it goes, then click “Add the part”. It goes next to the part you selected.' },
      { id: 'move', title: 'Move it', target: 'move', advance: when((c) => ids(c.state).length === ids(c.atStep).length && ids(c.state).join() !== ids(c.atStep).join()),
        text: 'The new part is selected. “Move earlier” or “Move later” changes its place in the circuit; try one.' },
      { id: 'remove', title: 'Remove it', target: 'remove', advance: when((c) => ids(c.state).length < ids(c.atStep).length),
        text: '“Remove” takes the selected part out again. Click it.' },
      { id: 'predict', title: 'What it predicts', target: 'predict', advance: next,
        text: 'The last step shows the model’s verdict for the circuit as it is now, and updates as you edit.' },
    ],
  },
  {
    id: 'pastBuilds', task: 'pastBuilds', title: 'Look back at past builds', minutes: 1, levels: ALL,
    blurb: 'Find an old build and compare two of them.',
    steps: [
      open('pastBuilds', 'Open the task', 'Click “Look back at past builds”. It lists every build saved in this browser.'),
      { id: 'tick1', title: 'Pick a build', target: 'build-check', advance: click,
        text: 'Each line is one build: its circuit, its date and its sweeps. Tick one.' },
      { id: 'compare', title: 'Compare two', target: 'compare', advance: next,
        text: 'Tick a second build and both appear here, each with its verdict, so you can see which was better.' },
      { id: 'open-project', title: 'Open a project', target: 'open-project', advance: next,
        text: '“Open” makes that project the current one. You do not need it now: this is practice.' },
    ],
  },
  {
    id: 'rigHistory', task: 'rigHistory', title: 'Rig history', minutes: 2, levels: ['engineer'],
    blurb: 'Every configuration ever swept on the rig, read-only.',
    steps: [
      open('rigHistory', 'Open the task', 'Click “Rig history”. It lists every sweep ever taken on the rig, day by day.'),
      { id: 'session', title: 'One rig session', target: 'session', advance: next,
        text: 'Each card is one day on the rig: what was built, the rig, and its sweeps. Open its sweeps to read each one with its evidence and anything that is uncertain.' },
      { id: 'copy', title: 'Open a copy', target: 'open-copy', advance: when((c) => c.task === 'pastBuilds'),
        text: '“Open a copy” loads that day’s sweeps as a project. Click it.' },
      { id: 'measured', title: 'Measured only', target: 'project-head', advance: next,
        text: 'The copy appears in Past builds marked “measured only”: it shows what the sweeps measured, with no model predictions.' },
    ],
  },
];
