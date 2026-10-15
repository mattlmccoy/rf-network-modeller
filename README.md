# RF Network Modeller

Browser tool for designing and tuning the RFAM matching network. Pick a level (Beginner, Builder, Engineer), then a task.
"I measured a new sweep" walks you through: confirm what's installed, load the `.s1p`, see whether the model agrees, and get
changes you can make from the parts on hand. The circuit is drawn as a power-flow diagram, the hardware in its cage, or a
schematic. Work autosaves in the browser; Save project / Open project move it between machines. Design:
`docs/superpowers/specs/2026-10-15-rf-network-modeller-ux-design.md`.

**Live:** https://mattlmccoy.github.io/rf-network-modeller/ (every push to `main` runs the tests, builds and redeploys).

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
