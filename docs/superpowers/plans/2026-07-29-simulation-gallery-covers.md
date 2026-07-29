# Simulation Gallery Covers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the five generic experiment-card placeholders with static, recognizable miniature apparatus diagrams.

**Architecture:** Add one focused `ExperimentCoverVisual` component that maps each registered experiment ID to semantic HTML shapes. Keep all visual styling in the existing gallery section of `app/globals.css`; `SimulationGallery` remains responsible only for card composition and navigation.

**Tech Stack:** React 19, TypeScript, CSS, Node test runner.

## Global Constraints

- Keep all files inside the Controlab project and all dependencies on E drive.
- Add no animation, image asset, SVG file, icon library, or runtime dependency.
- Preserve the existing experiment registry, navigation, card copy, and simulation behavior.
- Use Chinese comments when a code comment is necessary.
- Each cover must remain decorative with `aria-hidden="true"` and must not create horizontal overflow.

---

### Task 1: Dedicated experiment cover component

**Files:**
- Create: `components/simulations/ExperimentCoverVisual.tsx`
- Modify: `components/simulations/SimulationGallery.tsx`
- Test: `tests/simulation-ui-contract.test.mjs`

**Interfaces:**
- Consumes: `SimulationExperimentId` from `lib/simulation/experimentCatalog.ts`.
- Produces: `ExperimentCoverVisual({ experimentId }: { experimentId: SimulationExperimentId }): ReactElement`.

- [ ] **Step 1: Write the failing structural contract test**

```js
test("五个实验使用与对象对应的专属静态封面", async () => {
  const cover = await readFile(new URL("../components/simulations/ExperimentCoverVisual.tsx", import.meta.url), "utf8");
  for (const marker of ["cover-spring-mass", "cover-dc-motor", "cover-passive-rlc", "cover-active-sallen-key", "cover-cart-pole"]) {
    assert.match(cover, new RegExp(marker));
  }
  assert.doesNotMatch(cover, /<svg|animation|@keyframes/i);
});
```

- [ ] **Step 2: Run the contract test and verify RED**

Run: `node --test tests/simulation-ui-contract.test.mjs`

Expected: FAIL because `ExperimentCoverVisual.tsx` does not exist.

- [ ] **Step 3: Implement the dedicated covers**

Create a component with an exhaustive switch over the five experiment IDs. Each branch returns a shared `.simulation-card-visual` container and object-specific nodes, for example:

```tsx
export function ExperimentCoverVisual({ experimentId }: { experimentId: SimulationExperimentId }) {
  if (experimentId === "spring-mass") {
    return <div className="simulation-card-visual cover-spring-mass" aria-hidden="true"><span className="cover-wall" /><span className="cover-spring" /><span className="cover-damper" /><span className="cover-mass" /><span className="cover-rail" /></div>;
  }
  // 其余分支使用各自专属结构，末尾覆盖 cart-pole。
}
```

Replace the three generic `<i />` nodes in `SimulationGallery` with `<ExperimentCoverVisual experimentId={item.id as SimulationExperimentId} />`.

- [ ] **Step 4: Run the contract test and verify GREEN**

Run: `node --test tests/simulation-ui-contract.test.mjs`

Expected: all simulation UI contract tests PASS.

- [ ] **Step 5: Commit the structural change**

```bash
git add components/simulations/ExperimentCoverVisual.tsx components/simulations/SimulationGallery.tsx tests/simulation-ui-contract.test.mjs
git commit -m "add recognizable experiment cover structures"
```

### Task 2: Apparatus styling and validation

**Files:**
- Modify: `app/globals.css`
- Modify: `tests/simulation-ui-contract.test.mjs`

**Interfaces:**
- Consumes: object-specific classes created by `ExperimentCoverVisual`.
- Produces: responsive, static cover illustrations using the existing `--experiment-accent` CSS variable.

- [ ] **Step 1: Extend the failing CSS contract test**

```js
test("实验封面样式包含五种装置且没有动画", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  for (const selector of [".cover-spring-mass", ".cover-dc-motor", ".cover-passive-rlc", ".cover-active-sallen-key", ".cover-cart-pole"]) {
    assert.match(css, new RegExp(selector.replace(".", "\\.")));
  }
  assert.doesNotMatch(css.match(/\/\* 实验封面装置图 \*\/[\s\S]*?(?=\/\*|$)/)?.[0] ?? "", /animation\s*:|@keyframes/);
});
```

- [ ] **Step 2: Run the contract test and verify RED**

Run: `node --test tests/simulation-ui-contract.test.mjs`

Expected: FAIL because the five apparatus selectors do not exist.

- [ ] **Step 3: Draw the five static apparatus covers in CSS**

Replace the generic `.simulation-card-visual i` rules with a scoped `/* 实验封面装置图 */` block. Use pseudo-elements and the component nodes to draw:

- wall, zig-zag spring, damper, block and rail;
- cylindrical motor, rotor spokes, shaft and load;
- closed circuit loop with resistor, coil, capacitor and source;
- two RC stages, op-amp triangle and feedback line;
- cart body, wheels, thin upright pole and track.

Use `var(--experiment-accent)` for primary strokes, `#52616e` for structure, and no `animation` declarations.

- [ ] **Step 4: Run focused and full verification**

Run:

```bash
node --test tests/simulation-ui-contract.test.mjs
npm run lint
npm test
git diff --check
```

Expected: focused tests, lint, build and all project tests PASS with no errors.

- [ ] **Step 5: Browser QA and commit**

Open the production preview and verify all five objects are recognizable, aligned, static, and free of horizontal overflow at desktop and narrow widths. Then commit:

```bash
git add app/globals.css tests/simulation-ui-contract.test.mjs
git commit -m "redesign simulation gallery covers"
```
