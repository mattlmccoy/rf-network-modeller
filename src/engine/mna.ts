import { type Complex, ONE, OPEN, ZERO, add, cx, neg } from './complex.ts';
import { SingularMatrixError, solveLinear } from './linsolve.ts';
import type { Y2 } from './twoport.ts';

/** Two-terminal admittance between nodes a and b (0 = ground). */
export interface YElement { kind: 'y'; a: number; b: number; y: (f: number) => Complex }
/** Ground-referenced 2-port between node a (port 1) and node b (port 2). */
export interface Y2Element { kind: 'y2'; a: number; b: number; y: (f: number) => Y2 }
/** Ideal transformer 1:n: V(s1) − V(s2) = n·(V(p1) − V(p2)). */
export interface IdealElement { kind: 'ideal'; p1: number; p2: number; s1: number; s2: number; n: number }
export type Element = YElement | Y2Element | IdealElement;

/** Nodes are 0..nodeCount−1 with 0 = ground; a current source drives `port` against ground. */
export interface Netlist { nodeCount: number; port: number; elements: Element[] }
export interface Solution { v: Complex[]; idealCurrents: Complex[] }

export function solveNetlist(net: Netlist, f: number, iPort: Complex = ONE): Solution {
  const nv = net.nodeCount - 1;
  const ideals = net.elements.filter((e): e is IdealElement => e.kind === 'ideal');
  if (net.port === 0) return { v: Array.from({ length: net.nodeCount }, () => ZERO), idealCurrents: ideals.map(() => ZERO) };
  const size = nv + ideals.length;
  const A: Complex[][] = Array.from({ length: size }, () => Array.from({ length: size }, () => ZERO));
  const b: Complex[] = Array.from({ length: size }, () => ZERO);
  const put = (i: number, j: number, v: Complex): void => {
    if (i > 0 && j > 0) A[i - 1][j - 1] = add(A[i - 1][j - 1], v);
  };
  for (const e of net.elements) {
    if (e.kind === 'y') {
      const y = e.y(f);
      put(e.a, e.a, y);
      put(e.b, e.b, y);
      put(e.a, e.b, neg(y));
      put(e.b, e.a, neg(y));
    } else if (e.kind === 'y2') {
      const [y11, y12, y21, y22] = e.y(f);
      put(e.a, e.a, y11);
      put(e.a, e.b, y12);
      put(e.b, e.a, y21);
      put(e.b, e.b, y22);
    }
  }
  ideals.forEach((e, k) => {
    const q = nv + k; // row and column of this transformer's primary current
    const col = (node: number, v: Complex): void => {
      if (node > 0) A[node - 1][q] = add(A[node - 1][q], v);
    };
    const row = (node: number, v: Complex): void => {
      if (node > 0) A[q][node - 1] = add(A[q][node - 1], v);
    };
    col(e.p1, ONE);
    col(e.p2, neg(ONE));
    col(e.s1, cx(-1 / e.n));
    col(e.s2, cx(1 / e.n));
    row(e.p1, cx(e.n));
    row(e.p2, cx(-e.n));
    row(e.s1, neg(ONE));
    row(e.s2, ONE);
  });
  b[net.port - 1] = iPort;
  const x = solveLinear(A, b);
  return { v: [ZERO, ...x.slice(0, nv)], idealCurrents: x.slice(nv) };
}

/** Impedance looking into the port; OPEN when no current path exists (singular matrix). */
export function inputImpedance(net: Netlist, f: number): Complex {
  try {
    return solveNetlist(net, f).v[net.port];
  } catch (err) {
    if (err instanceof SingularMatrixError) return OPEN;
    throw err;
  }
}
