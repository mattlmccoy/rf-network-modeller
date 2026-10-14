"""Capture reference outputs from the real RFAM network Python for the TypeScript parity tests.

Run from the repo root:
  VECLIB_MAXIMUM_THREADS=2 uv run --no-project --python 3.12 --with numpy --with scipy python tools/capture_fixtures.py

Reads the model code in MANUAL_MATCHING_NETWORK/2026-10-10_DESIGN_SPACE/model (override with RFNM_MNET) and the sweeps
in fixtures/sweeps. Writes fixtures/python/*.json; never edit those by hand. Exits 1, writing nothing for the O7 file, if
the O7 recipe stops reproducing the predictions recorded in 2026-10-13_O7-4core_parallel_build/SWEEP_NOTES.md L490/L522.
"""
from __future__ import annotations

import dataclasses
import hashlib
import json
import os
import sys
from pathlib import Path

import numpy as np
from scipy.optimize import least_squares

ROOT = Path(__file__).resolve().parents[1]
MNET = Path(os.environ.get("RFNM_MNET", "/Users/mattmccoy/GaTech Dropbox/Matthew McCoy/mattmccoy-research/research/"
                           "binderjet/experiments/rf_sintering/MANUAL_MATCHING_NETWORK"))
MODEL = MNET / "2026-10-10_DESIGN_SPACE" / "model"
sys.path.insert(0, str(MODEL))
import calib  # noqa: E402
import design as dz  # noqa: E402
import rfchain as rc  # noqa: E402

SW = ROOT / "fixtures" / "sweeps"
OUT = ROOT / "fixtures" / "python"
CAPFREE = "noAIT_trans1_3pri_15sec_trans2_3pri_15sec_direct_LOAD-ATTACHED_nanovna-sweep-1791927664566.s1p"
S130 = "noAIT_130ser_230sh_full_4core_parallel_315turnsratio_load_nanovna-sweep-1791930836256.s1p"
S100 = "noAIT_100ser_200sh_full_4core_parallel_315turnsratio_load_nanovna-sweep-1791931275980.s1p"
S80 = "noAIT_80ser_200sh_full_4core_parallel_315turnsratio_load_nanovna-sweep-1791931754256.s1p"
S80L = "noAIT_sense-loop_80ser_200sh_full_4core_parallel_315turnsratio_load_nanovna-sweep-1791932761517.s1p"
S180L = "noAIT_sense-loop_80ser_180sh_full_4core_parallel_315turnsratio_load_nanovna-sweep-1791933400391.s1p"
SHORT_OLD = "coax-jumpers-shorted_nanovna-sweep-1791923630763.s1p"
SHORT_NEW = "coax-jumpers-shorted_for_both_trans_nanovna-sweep-1791928236499.s1p"
CD_NET = "2026-10-01_NET_218_CD_100s_3x100+30p_10-18M_PRE-loop_nanovna-sweep-1790884838445.s1p"
VARIANTS = (("1.245", 1.245, 342e-9), ("1.2825", 1.2825, 329e-9), ("1.5094", 1.5094, 256e-9))
WIN = (5.0, 17.0, 6.0, 48.0)
X0 = [300.0, 150.0, 1.0, 1.0, 1.0]
BOUNDS = ([150.0, -100.0, 0.8, 0.8, 0.2], [700.0, 600.0, 1.5, 1.5, 3.0])
# SWEEP_NOTES.md L490 (2-sweep fit -> 80/200) and L522 (3-sweep fit + loop -> 80/180 + loop), rounded to 0.1 ohm there.
RECORDED_80_200 = {"1.245": (6.4, 6.6, 12.6, 12.6), "1.2825": (6.4, 6.6, 12.6, 12.6), "1.5094": (4.8, 4.8, 8.0, 8.0)}
RECORDED_80_180L = {"1.245": (6.7, 7.2, 16.9, 18.1), "1.2825": (6.7, 7.2, 16.9, 18.1), "1.5094": (4.9, 5.0, 11.4, 11.4)}


def sha(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def cx(z) -> list:
    z = complex(z)
    return [z.real, z.imag]


def load(name: str):
    d = np.loadtxt(SW / name, comments=("!", "#"))
    return d[:, 0], d[:, 1] + 1j * d[:, 2]


def zport(g):
    return 50 * (1 + g) / (1 - g)


def unit_dict(u) -> dict:
    return dict(n=u.n, L_leak=u.L_leak, f_pri=u.f_pri, L_m=u.L_m, G_core=u.G_core, R1=u.R1, R2=u.R2, C_w=u.C_w,
                N_p=u.N_p, N_c=u.N_c)


def dump(name: str, obj: dict) -> None:
    obj["_sources"] = {p.name: sha(p) for p in (MODEL / "rfchain.py", MODEL / "design.py", MODEL / "calib.py",
                                                 MODEL / "builds_fit.json")}
    obj["_sweeps"] = {p.name: sha(p) for p in sorted(SW.glob("*.s1p"))}
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / name).write_text(json.dumps(obj, indent=1))
    print("wrote", (OUT / name).relative_to(ROOT))


def cd_preset():
    bf = json.loads((MODEL / "builds_fit.json").read_text())["CD_0930_load|0.0|0.0"]
    u = rc.Unit(n=bf["n"], L_leak=bf["L_leak"], f_pri=0.0, L_m=bf["L_m"], G_core=bf["G_core"], R1=bf["R1"],
                R2=bf["R2"], C_w=0.0, N_p=bf["N_p"], N_c=bf["N_c"])
    return u, rc.PlateLoad(C=bf["C"], G_cube=0.0, G_fix=bf["G_sec"])


def capture_rfchain() -> None:
    cd, cd_load = cd_preset()
    k = dz.Consts()
    o7u = dz.make_unit(dz.Design(N_p=3, N_s=15, N_c=4), k)
    cases = [("cd_fpri0", [cd], cd_load),
             ("cd_fpri01_cw", [dataclasses.replace(cd, f_pri=0.1, C_w=0.2e-12)],
              rc.PlateLoad(C=cd_load.C, G_cube=0.3e-6, G_fix=cd_load.G_fix)),
             ("o7_estimate_pair", [o7u, o7u], rc.PlateLoad(C=k.C_plate, G_cube=k.G_cube, G_fix=k.G_plate))]
    nets = [rc.Network(c_series=80e-12, c_shunt=180e-12, esr_series=0.01, esr_shunt=0.02, l_series=100e-9, r_lseries=0.05),
            rc.Network(c_series=100e-12, c_shunt=330e-12, l_series=50e-9)]
    cables = [rc.Cable(length=1.245, vf=0.70, z0=50.0, alpha_13=0.0),
              rc.Cable(length=1.5094, vf=0.70, z0=50.0, alpha_13=0.0073)]
    out = []
    for name, units, ld in cases:
        for ni, net in enumerate(nets):
            for ci, cab in enumerate(cables):
                rows = []
                for f in (1e6, 5e6, 9.85e6, 13.56e6, 20e6, 25e6):
                    zx = complex(rc.input_impedance(units, ld, f))
                    zin = complex(rc.network_input(zx, net, f))
                    emb = complex(rc.embed(zin, cab, f))
                    st = rc.solve_chain(units, ld, net, cab, f, p_ait_out=100.0)
                    tr = st.transformer
                    rows.append(dict(
                        f=f, abcd=[[cx(v) for v in np.asarray(rc.unit_abcd(u, f)).reshape(-1)] for u in units],
                        zx=cx(zx), zin=cx(zin), emb=cx(emb), de=cx(rc.deembed(emb, cab, f)),
                        chain=dict(z_ait=cx(st.z_ait), z_net_in=cx(st.z_net_in), i_series=cx(st.i_series),
                                   v_series_cap=float(st.v_series_cap), i_shunt=cx(st.i_shunt), v_node=cx(st.v_node),
                                   i_branch=cx(st.i_branch), p_esr_series=float(st.p_esr_series),
                                   p_esr_shunt=float(st.p_esr_shunt), p_lseries=float(st.p_lseries),
                                   p_cable=float(st.p_cable), v1=cx(tr.v1), v2=cx(tr.v2), i1_total=cx(tr.i1_total),
                                   p_cube=float(tr.p_cube), p_fix=float(tr.p_fix),
                                   units=[dict(i1=cx(s.i1), vm=cx(s.vm), i_r2=cx(s.i_r2), p_r1=float(s.p_r1),
                                               p_core=float(s.p_core), p_r2=float(s.p_r2), b_pk_mT=float(s.b_pk_mT),
                                               v_loop_rms=float(s.v_loop_rms)) for s in tr.units])))
                out.append(dict(name=f"{name}/net{ni}/cable{ci}", units=[unit_dict(u) for u in units],
                                load=dict(C=ld.C, G_cube=ld.G_cube, G_fix=ld.G_fix),
                                net=dict(c_series=net.c_series, c_shunt=net.c_shunt, esr_series=net.esr_series,
                                         esr_shunt=net.esr_shunt, l_series=net.l_series, r_lseries=net.r_lseries),
                                cable=dict(length=cab.length, vf=cab.vf, z0=cab.z0, alpha13=cab.alpha_13), rows=rows))
    dump("rfchain_cases.json", dict(cases=out))


def capture_design() -> None:
    k = dz.Consts()
    designs = [dz.Design(N_p=2, N_s=18, N_c=2), dz.Design(N_p=3, N_s=15, N_c=4), dz.Design(N_p=2, N_s=16, N_c=4, strap=True)]
    dump("design_units.json", dict(consts=dataclasses.asdict(k), designs=[
        dict(N_p=d.N_p, N_s=d.N_s, N_c=d.N_c, strap=d.strap, turn_length_mm=dz.turn_length_mm(d.N_c),
             unit=unit_dict(dz.make_unit(d, k))) for d in designs]))


def make_zin(f, w, z15, ln, lj):
    """o7_joint.py / o7_loopstate.py board model for one cable variant, re-embedded through the same cable."""
    cab = rc.Cable(length=ln, vf=0.70, z0=50.0, alpha_13=0.0)
    zp0 = rc.deembed(z15, cab, f) - 1j * w * lj

    def zin(p, cs, cp, d=0.0):
        zp = np.interp(f * (1 + d), f, zp0.real) + 1j * np.interp(f * (1 + d), f, zp0.imag)
        zb = p[4] * zp.real + 1j * zp.imag + 1j * w * p[1] * 1e-9
        return rc.embed(1 / (1j * w * cs * p[2]) + 1j * w * p[0] * 1e-9 + 1 / (1 / zb + 1j * w * cp * p[3]), cab, f)
    return zin


def residual(zin, states, band):
    def res(p):
        out = []
        for cs, cp, gm in states:
            zi = zin(p, cs, cp)
            r = ((zi - 50) / (zi + 50) - gm)[band]
            out += [r.real, r.imag]
        return np.concatenate(out)
    return res


def combos(nmax):
    return [(a, b, c) for a in range(nmax + 1) for b in range(nmax + 1) for c in range(nmax + 1) if 0 < a + b + c <= nmax]


def inwin(z):
    return (z.real >= WIN[0]) & (z.real <= WIN[1]) & (z.imag >= WIN[2]) & (z.imag <= WIN[3])


def rooms_contiguous(f, z, k0, seg):
    """Contiguous in-window band around k0 inside seg (spec section 9); -99 when 13.56 MHz is out of the window."""
    if not (bool(inwin(z[k0:k0 + 1])[0]) and bool(seg[k0])):
        return -99.0, -99.0
    hi = k0
    while hi + 1 < len(f) and seg[hi + 1] and inwin(z[hi + 1:hi + 2])[0]:
        hi += 1
    lo = k0
    while lo - 1 >= 0 and seg[lo - 1] and inwin(z[lo - 1:lo])[0]:
        lo -= 1
    return float((f[hi] - 13.56e6) / 13.56e6 * 100), float((13.56e6 - f[lo]) / 13.56e6 * 100)


def capture_recommend(f, k0, seg, models) -> dict:
    """o7_joint.py enumeration with the loop-state models (3-sweep fit + loop shift); current build 80/200."""
    cur_s, cur_p = (0, 1, 1), (2, 0, 0)
    vals = (100, 50, 30)
    rows = []
    for s in combos(2):
        for p in combos(4):
            if s[0] + p[0] > 10 or s[1] + p[1] > 3 or s[2] + p[2] > 2:
                continue
            cs = sum(n * v for n, v in zip(s, vals)) * 1e-12
            cp = sum(n * v for n, v in zip(p, vals)) * 1e-12
            lands, ups, downs = [], [], []
            for zin, p3, q in models:
                z = zin(p3, cs, cp, d=q * 1e-2)
                up, down = rooms_contiguous(f, z, k0, seg)
                lands.append(cx(z[k0]))
                ups.append(up)
                downs.append(down)
            rows.append(dict(series=list(s), shunt=list(p), landings=lands, room_up=ups, room_down=downs,
                             n_in=sum(1 for u in ups if u != -99.0),
                             moves=sum(abs(a - b) for a, b in zip(s, cur_s)) + sum(abs(a - b) for a, b in zip(p, cur_p))))
    good = [r for r in rows if r["n_in"] * 2 > len(models)]
    good.sort(key=lambda r: (-r["n_in"], -min(sorted(r["room_up"])[(len(models) - 1) // 2], 2.5), r["moves"]))
    top = [[r["series"], r["shunt"]] for r in good[:12]]
    print(f"recommend: {len(rows)} candidates, {len(good)} with a majority in window; top 3 {top[:3]}")
    return dict(current=dict(series=list(cur_s), shunt=list(cur_p)), count=len(rows), candidates=rows, top12=top,
                seg=[12.5e6, 14.6e6], seg_points=int(np.count_nonzero(seg)))


def capture_o7() -> None:
    f, g15 = load(CAPFREE)
    meas = {name: load(name)[1] for name in (S130, S100, S80, S80L, S180L)}
    w = 2 * np.pi * f
    z15 = zport(g15)
    k0 = int(np.argmin(abs(f - 13.56e6)))
    band = (f > 12.0e6) & (f < 14.6e6)
    seg = (f > 12.5e6) & (f < 14.6e6)
    st2 = [(130e-12, 230e-12, meas[S130]), (100e-12, 200e-12, meas[S100])]
    st3 = st2 + [(80e-12, 200e-12, meas[S80])]
    out, bad, models = [], [], []
    for name, ln, lj in VARIANTS:
        zin = make_zin(f, w, z15, ln, lj)
        s2 = least_squares(residual(zin, st2, band), X0, bounds=BOUNDS)
        s3 = least_squares(residual(zin, st3, band), X0, bounds=BOUNDS)

        def rl(q, zin=zin, p3=s3.x):
            zi = zin(p3, 80e-12, 200e-12, d=q[0] * 1e-2)
            r = ((zi - 50) / (zi + 50) - meas[S80L])[band]
            return np.concatenate([r.real, r.imag])
        sq = least_squares(rl, [20.0], bounds=([-200.0], [400.0]))
        q = float(sq.x[0])
        p80 = complex(zin(s2.x, 80e-12, 200e-12)[k0])
        p180 = complex(zin(s3.x, 80e-12, 180e-12, d=q * 1e-2)[k0])
        samples = [dict(index=i, cs=cs, cp=cp, z=cx(zin(s2.x, cs, cp)[i]))
                   for i in (0, k0 - 100, k0, k0 + 100, len(f) - 1) for cs, cp in ((80e-12, 200e-12), (130e-12, 230e-12))]
        loop_samples = [dict(index=i, z=cx(zin(s3.x, 80e-12, 180e-12, d=q * 1e-2)[i])) for i in (0, k0, len(f) - 1)]
        out.append(dict(variant=name, length=ln, Lj=lj,
                        fit2=dict(x=[float(v) for v in s2.x], cost=float(s2.cost),
                                  rms=float(np.sqrt(np.mean(s2.fun ** 2) * 2)), pred_80_200=cx(p80), samples=samples),
                        fit3=dict(x=[float(v) for v in s3.x], cost=float(s3.cost),
                                  rms=float(np.sqrt(np.mean(s3.fun ** 2) * 2))),
                        loop=dict(q=q, cost=float(sq.cost), pred_80_180_loop=cx(p180), samples=loop_samples)))
        models.append((zin, s3.x, q))
        print(f"{name}: 80/200 {p80.real:.2f}{p80.imag:+.2f}j   loop q {q:.2f}%   80/180+loop {p180.real:.2f}{p180.imag:+.2f}j")
        for (lo_r, hi_r, lo_x, hi_x), z, tag, slack in ((RECORDED_80_200[name], p80, "L490 80/200", 0.1),
                                                        (RECORDED_80_180L[name], p180, "L522 80/180+loop", 0.15)):
            if not (lo_r - slack <= z.real <= hi_r + slack and lo_x - slack <= z.imag <= hi_x + slack):
                bad.append(f"{name} {tag}: {z:.2f} outside recorded R {lo_r}-{hi_r}, X {lo_x}-{hi_x}")
    if bad:
        print("RECIPE NO LONGER REPRODUCES SWEEP_NOTES:\n  " + "\n  ".join(bad))
        sys.exit(1)
    rec = capture_recommend(f, k0, seg, models)
    dump("o7_fit.json", dict(k0=k0, f_k0=float(f[k0]), band=[12.0e6, 14.6e6], window=list(WIN), x0=X0,
                             bounds=[list(BOUNDS[0]), list(BOUNDS[1])], variants=out, recommend=rec))


def capture_tmodel_and_short() -> None:
    f, g = load(CAPFREE)
    w = 2 * np.pi * f
    cab = rc.Cable(length=1.245, vf=0.70, z0=50.0, alpha_13=0.0)
    zp = rc.deembed(zport(g), cab, f) - 1j * w * 342e-9
    r = calib.fit_one_port(f, zp, n=5.0, f_pri=0.0, n_p=3, n_c=4)
    m = int(np.count_nonzero((f >= 2e6) & (f <= 25e6)))
    tm = dict(variant="1.245", n=5.0, n_p=3, n_c=4, f_pri=0.0, k1=0.7, f_lo=2e6, f_hi=25e6, unit=unit_dict(r.unit),
              load=dict(C=r.load.C, G_cube=r.load.G_cube, G_fix=r.load.G_fix), rms_rel=float(r.rms_rel), n_res=2 * m,
              cost=float(0.5 * 2 * m * r.rms_rel ** 2))
    print(f"tmodel: rms_rel {r.rms_rel:.4f}  L_leak {r.unit.L_leak:.3e}  L_m {r.unit.L_m:.3e}  C {r.load.C:.3e}")
    shorts = []
    for name in (SHORT_NEW, SHORT_OLD):
        fs, gs = load(name)
        zs, ws = zport(gs), 2 * np.pi * fs
        msk = (fs >= 2e6) & (fs <= 25e6)

        def res(x, zs=zs, ws=ws, fs=fs, msk=msk):
            c = rc.Cable(length=x[0], vf=0.70, z0=50.0, alpha_13=0.0)
            e = (rc.deembed(zs, c, fs) - 1j * ws * x[1] * 1e-9)[msk]
            return np.r_[e.real, e.imag]
        fixed = []
        for ln in (1.245, 1.2825, 1.5094):
            s1 = least_squares(lambda x, ln=ln: res([ln, x[0]]), [300.0], bounds=([0.0], [2000.0]))
            fixed.append(dict(length=ln, L_nH=float(s1.x[0]), rms=float(np.sqrt(np.mean(s1.fun ** 2)))))
        s = least_squares(res, [1.3, 300.0], bounds=([0.5, 0.0], [3.0, 2000.0]))
        shorts.append(dict(file=name, band=[2e6, 25e6], fixed=fixed,
                           free=dict(length=float(s.x[0]), L_nH=float(s.x[1]), rms=float(np.sqrt(np.mean(s.fun ** 2))))))
        print(f"short {name[:36]}: fixed " + " ".join(f"{x['length']} m {x['L_nH']:.0f} nH" for x in fixed)
              + f" | free {s.x[0]:.4f} m {s.x[1]:.0f} nH")
    dump("tmodel_short.json", dict(tmodel=tm, shorts=shorts))


def capture_cd() -> None:
    u, ld = cd_preset()
    cab = rc.Cable(length=1.5094, vf=0.70, z0=50.0, alpha_13=0.0)
    f, g = load(CD_NET)
    k0 = int(np.argmin(abs(f - 13.56e6)))
    fk = float(f[k0])
    zx = complex(rc.input_impedance([u], ld, fk))
    zin = complex(rc.network_input(zx, rc.Network(c_series=100e-12, c_shunt=330e-12), fk))
    pred = complex(rc.embed(zin, cab, fk))
    meas = complex(zport(g[k0]))
    dump("cd_check.json", dict(f=fk, unit=unit_dict(u), load=dict(C=ld.C, G_cube=ld.G_cube, G_fix=ld.G_fix),
                               cable_length=1.5094, c_series=100e-12, c_shunt=330e-12, pred=cx(pred), meas=cx(meas)))
    print(f"C+D check at {fk / 1e6:.4f} MHz: predicted {pred:.2f}, measured {meas:.2f}")


if __name__ == "__main__":
    capture_rfchain()
    capture_design()
    capture_o7()
    capture_tmodel_and_short()
    capture_cd()
