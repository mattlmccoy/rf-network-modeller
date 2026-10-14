# RF Network Modeller

Browser tool for designing and tuning the RFAM matching network: build a chain of blocks, see the predicted VNA
response, fit it to measured sweeps, get stock-cap recommendations and part stress. Design:
`docs/superpowers/specs/2026-10-14-rf-network-modeller-design.md`.

```bash
npm install
npm run dev         # the app at http://localhost:5181 (opens on the O7 example)
npm test            # unit + parity tests
npm run typecheck
npm run build       # static site in dist/ (open dist/index.html through any static server)
npm run validate    # blind replay of the 2026-10-13 history -> docs/validation/
npm run example     # rebuild public/examples/o7 from the fixtures
```

Reference fixtures come from the real Python model (`tools/capture_fixtures.py`); never edit `fixtures/python/` by hand.
