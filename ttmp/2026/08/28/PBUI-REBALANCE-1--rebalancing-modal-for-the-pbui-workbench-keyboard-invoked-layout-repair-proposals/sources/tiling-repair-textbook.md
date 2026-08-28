# Repairing a Tiling Layout

### A study of minimum-perturbation algorithms over n-ary split trees

---

This document explains the repair lab: what it models, how each test layout is constructed and what failure it isolates, and how each of the nine repair algorithms works. The goal is not to catalogue an API but to give you enough of the underlying reasoning that you could implement any of these algorithms yourself, choose between them for a real window manager, and predict what each will do before you run it.

Every number in this document was produced by the code it describes, at a single reference configuration stated in §1.10. Traces are copied from the lab's own output.

---

## Part I — The Setup

### 1.1 The representation

A tiling layout is a tree. Three node types:

```js
{t:'p', id, name}                 // pane: a window, always a leaf
{t:'s', id, axis:'h'|'v', ch, w}  // split: n children, n weights summing to 1
{t:'k', id, ch, active}           // stack: n children sharing one rectangle
```

A split is n-ary rather than binary. A row of five panes is one `Row` node with five children and five weights, not four nested binary splits. This choice determines almost everything that follows. In a binary tree, "make the third pane wider" has no single answer — it depends which of several equivalent binary encodings the layout happens to have, and the encodings are not visually distinguishable. In an n-ary tree the question is well posed: the third pane's width is `w[2]`, and its neighbours are `ch[1]` and `ch[3]`.

Weights are fractions of the parent's available space, not pixels. A split holds the invariant `Σw = 1`. Any operation that changes weights must restore that sum, and the lab's interactive divider drag maintains a stronger one: it moves space between two adjacent children while holding `w[i] + w[i+1]` constant, so a divider drag never disturbs anything outside the pair it separates.

A stack is a set of panes that share a rectangle, with one visible at a time and a tab strip along the top. Stacks matter for repair because they are the only construct that changes the number of *visible* panes, which makes them the fallback when geometry runs out.

### 1.2 From tree to rectangles

Layout is a recursive descent. A node receives a rectangle; a split subtracts the gaps, divides the remainder by weight, and hands each child its slice:

```js
function layoutTree(node, r, out, gap){
  out[node.id]={...r};
  if(!node.ch) return out;
  if(node.t==='k'){ node.ch.forEach(c=>layoutTree(c,r,out,gap)); return out; }
  const horiz = node.axis==='h';
  const avail = (horiz?r.w:r.h) - gap*(node.ch.length-1);
  let pos = horiz?r.x:r.y;
  node.ch.forEach((c,i)=>{
    const sz = node.w[i]*avail;
    layoutTree(c, horiz?{x:pos,y:r.y,w:sz,h:r.h}:{x:r.x,y:pos,w:r.w,h:sz}, out, gap);
    pos += sz + gap;
  });
  return out;
}
```

Two properties of this function drive the rest of the document. First, `avail` is the parent's extent *minus the gaps*, so a weight of 0.25 in a five-child row is 25% of `(width − 4·gap)`, not 25% of the width. Any constraint expressed in pixels must be converted against `avail`, not against the raw rectangle. Second, position is accumulated left to right, which means changing `w[0]` moves every subsequent child. Displacement is therefore not proportional to how many weights you changed — one weight at the front of a long row moves everything behind it.

### 1.3 Why a local minimum weight is the wrong constraint

The natural first attempt at a size constraint is a floor on the weight: no child may take less than 10% of its split. The original tiling lab used exactly this, `minW = 0.10`, and it does not work.

Sizes multiply down the tree. Consider the `COMPOUND` layout:

```js
SP('h',[ P('A'),
         SP('v',[ P('B'),
                  SP('h',[P('C'),P('D')],[.7,.3]) ],[.85,.15]) ],[.8,.2])
```

Every weight in that tree is at or above 0.15, so a per-split floor of 0.10 reports the layout as healthy. The actual rectangles at the reference screen:

```
A   851×656
B   213×551
C   143×97
D    61×97
```

D is 61 pixels wide and 97 tall. It is a window in name only. The layout satisfies the constraint at every split and violates the thing the constraint was meant to protect, because 0.2 × 0.15 × 0.3 = 0.009 of the screen.

The constraint you actually want is a floor in pixels on the rendered rectangle of each visible pane. That constraint is not local to any split — a split cannot check it without knowing how much space it will itself receive, which depends on its ancestors. Making a non-local constraint checkable locally is the job of the next section.

### 1.4 Minimum-size propagation

Every subtree has a minimum width and height, computed bottom-up from the pane floors:

```js
function propagate(node, cfg, memo={}){
  if(memo[node.id]) return memo[node.id];
  let r;
  if(node.t==='p') r={w:cfg.minW, h:cfg.minH};
  else if(node.t==='k'){
    r={w:cfg.minW, h:cfg.minH};
    node.ch.forEach(c=>{ const q=propagate(c,cfg,memo); r={w:Math.max(r.w,q.w), h:Math.max(r.h,q.h)}; });
    r={w:r.w, h:r.h+cfg.tabH};
  } else {
    const q=node.ch.map(c=>propagate(c,cfg,memo));
    const g=cfg.gap*(node.ch.length-1);
    r = node.axis==='h'
      ? {w:sum(q.map(x=>x.w))+g, h:Math.max(...q.map(x=>x.h))}
      : {w:Math.max(...q.map(x=>x.w)), h:sum(q.map(x=>x.h))+g};
  }
  memo[node.id]=r;
  return r;
}
```

The three rules, stated plainly:

- A pane needs `(minW, minH)`.
- A row needs the **sum** of its children's widths plus the gaps between them, and the **maximum** of their heights. A column is the transpose.
- A stack needs the maximum over its members in both axes, plus the height of the tab strip. Its members share one rectangle, so the binding constraint is the largest member, and the tab strip is real pixels that no pane gets to use.

The result is a single number per subtree per axis that summarises everything an ancestor needs to know. `Col(6)` of ordinary panes needs `6·130 + 5·8 = 820` pixels of height, and its parent can now reason about it as one object with a hard height requirement, without descending into it.

Propagation is a linear pass with memoisation: 0.006 ms for an eight-pane tree. It is cheap enough to run on every keystroke, and every other algorithm in this document depends on it.

### 1.5 Feasibility at three scales

With propagated minimums, "does the layout fit" splits into three distinct questions, and confusing them is the most common source of bad repair behaviour.

| Scale | Question | Test |
|---|---|---|
| Split-local | Can this split satisfy its children by moving weights? | `Σ lower[i] ≤ avail` |
| Subtree | Does this subtree have enough room from its parent? | `req(node) ≤ rect(node)` on each axis |
| Global | Can any layout with this tree satisfy every pane? | `req(root) ≤ screen` |

A split whose children need 1174 px when it has 1048 cannot be fixed by any weight assignment, no matter how clever. Its parent must give it more room — or the tree itself must change. The distinction between "this split is locally infeasible" and "this tree is globally infeasible" is the difference between escalating one level and giving up on the topology entirely.

At the reference configuration, `WIDE ROW 9` needs 1774 px of width on a 1072 px screen. No algorithm that only moves weights can repair it, and the lab shows exactly that: five weight algorithms leave all nine panes broken, and only structural change succeeds.

### 1.6 One top-down pass

Given propagated minimums, the whole repair reduces to a single depth-first pass. At each split, convert the children's pixel requirements into fractional lower bounds against that split's own `avail`, and hand them to a strategy that returns a new weight vector:

```js
function* repairPass(root, rect, cfg, strat, ctx){
  const memo={};
  const need=propagate(root,cfg,memo);
  if(need.w>rect.w+0.5||need.h>rect.h+0.5) ctx.globalInfeasible=true;
  yield* rec(root, rect, 0);

  function* rec(n, r, d){
    if(n.t==='p') return;
    if(n.t==='k'){ for(const c of n.ch) yield* rec(c, r, d+1); return; }
    const horiz=n.axis==='h';
    const avail=(horiz?r.w:r.h)-cfg.gap*(n.ch.length-1);
    const lower=n.ch.map(c=>Math.min(horiz?memo[c.id].w:memo[c.id].h, avail));
    const cur=n.w.map(w=>w*avail);
    const short=cur.map((p,i)=>lower[i]-p).filter(x=>x>0.5+(cfg.hyst||0));
    if(short.length || strat.always){
      ctx.cross = horiz ? r.h : r.w;
      n.w = yield* strat(n, avail, lower, cfg, ctx);
    }
    let pos=horiz?r.x:r.y;
    for(let i=0;i<n.ch.length;i++){
      const sz=n.w[i]*avail;
      const cr = horiz?{x:pos,y:r.y,w:sz,h:r.h}:{x:r.x,y:pos,w:r.w,h:sz};
      pos+=sz+cfg.gap;
      yield* rec(n.ch[i], cr, d+1);
    }
  }
}
```

Why is one pass enough, and why does it fix both axes when each split only controls one?

Because propagation already crossed the axes. A `Row` reports a height requirement equal to the maximum of its children's heights. Its parent `Col` sees that number as an ordinary along-axis requirement and satisfies it before recursing. By the time control reaches the `Row`, the height it holds is already sufficient for everything inside it. Each split fixes its own axis; the cross axis was fixed by whichever ancestor owns it. Nothing needs a second sweep.

The recursion also has the right dependency order. Children are laid out *after* the parent's weights are updated, so each child receives the corrected rectangle rather than the stale one. A pass that computed all rectangles first and then fixed splits would need to iterate to a fixpoint.

`cfg.hyst` enters at exactly one place: the trigger comparison. Repair fires when a deficit exceeds `0.5 + hyst` pixels, but it always repairs up to the full requirement. That asymmetry is deliberate — it is what stops a layout from re-repairing itself on every one-pixel window resize.

### 1.7 Algorithms as coroutines

Every algorithm in the lab is a generator that mutates the tree and yields log records:

```js
function* stratSparse(node, avail, lower, cfg, ctx){
  ...
  yield {c:'grn', t:`  ${lab(node.ch[i])} short ${R0(want)}px → single donor ...`};
  ...
  return newWeights;
}
```

This is not a stylistic choice. It gives one implementation for four different execution modes: run to completion (`for (const _ of gen) {}`), single-step for inspection, timed playback for animation, and batch evaluation for the proposal slate. An algorithm written as a plain function would need either a duplicate instrumented version or a callback protocol threaded through every recursive call. `yield*` also composes: the escalation pipeline of §12 delegates to `repairPass`, which delegates to a strategy, and the log arrives at the caller in order with no plumbing.

The strategy signature returns its result rather than mutating in place, and the driver assigns it. Strategies that must run on healthy splits as well as broken ones set a flag:

```js
stratRelax.always   = true;
stratBalance.always = true;
```

### 1.8 Measuring change

Repair quality has two axes, and they trade off. The first is correctness: how many panes remain below their minimum. The second is disruption: how much the user's layout moved. The lab measures disruption four ways because no single number captures it.

```js
d = |Δcentre_x| + |Δcentre_y| + |Δwidth| + |Δheight|      // per pane
```

- **Panes moved** — the count with `d > 1`. Coarse, and misleading in deep trees, where changing one weight near the root moves everything downstream.
- **Σ displacement** — the sum of `d` over visible panes. The primary number.
- **Largest single move** — `max d`. Distinguishes "everything shifted slightly" from "one window teleported."
- **Dividers moved** — the count of split boundaries whose cumulative position changed by more than 0.004. Only defined when the tree structure is unchanged, but when it is defined it is the number closest to what a user perceives.

Panes are matched between before and after by identity, not position. Node ids survive cloning, mutation, regeneration and folding, so the comparison remains meaningful even when the tree is rebuilt from scratch.

### 1.9 Classifying change

Displacement is a scalar, and users do not experience layout change as a scalar. A repair that moves two dividers by 40 px is a different *kind* of event from one that reorders panes, which is different again from one that discards the tree. The lab classifies each result into a tier, and the classification is measured from the result rather than declared by the algorithm that produced it:

```js
function sig(n, ordered){
  if(n.t==='p') return n.name;
  if(n.t==='k') return 'K['+n.ch.map(c=>c.name).join(',')+']';
  const kids=n.ch.map(c=>sig(c,ordered));
  return n.axis+'('+(ordered?kids:kids.slice().sort()).join(',')+')';
}

function classify(before, after, gen, s){
  const vb=visibleLeaves(before).map(p=>p.name).sort().join(','),
        va=visibleLeaves(after ).map(p=>p.name).sort().join(',');
  if(vb!==va)      return {tier:6, div:null};              // panes hidden behind tabs
  if(s.moved===0)  return {tier:0, div:0};                 // nothing happened
  if(sig(before,true)===sig(after,true)){                  // same tree, same order
    const d=dividerDiff(before,after);
    return {tier:d<=2?1:2, div:d};
  }
  if(sig(before,false)===sig(after,false)) return {tier:3, div:null};  // reordered
  return {tier: gen.kind==='rebuild'?5:4, div:null};
}
```

| Tier | Chip | Meaning |
|---|---|---|
| 0 | — | Geometry unchanged |
| 1 | W1 | Weights only, one or two dividers moved |
| 2 | W+ | Weights only, many dividers moved |
| 3 | ORD | Same splits, children reordered |
| 4 | STR | Tree structure changed |
| 5 | NEW | Layout rebuilt from scratch |
| 6 | TAB | Visible pane set changed |

Measuring rather than declaring matters. `REBUILD master` applied to a layout that already has master shape produces the same tree with different weights, and it is reported as a tier-1 weight change, because that is what it turned out to be. An algorithm's ambition is not the same as its effect.

### 1.10 Reference configuration

Every number in this document uses these constants unless stated otherwise:

| Constant | Value | Meaning |
|---|---|---|
| screen (usable rect) | 1072 × 656 px | The desktop area, inset 6 px from the frame |
| `minW`, `minH` | 190 × 130 px | Pixel floor for a visible pane |
| `gap` | 8 px | Space between siblings |
| `tabH` | 14 px | Tab strip height charged to a stack |
| `aspect` | 1.40 | Target width : height for the aspect term |

For a row spanning the full screen, `avail = 1072 − (n−1)·8`. With four children that is 1048 px, and the lower bound each child must clear is `190 / 1048 = 0.1813` in weight units. That number appears repeatedly below.

### 1.11 Key points for Part I

- Weights are fractions of a parent's available space, so pane size is a product of weights down a path and cannot be constrained split-locally.
- Minimum-size propagation converts a non-local pixel constraint into a per-split lower bound, in one linear pass.
- A row sums widths and maxes heights; a column does the reverse; a stack maxes both and adds the tab strip.
- Because propagation crosses the axes, a single top-down pass repairs both axes with no iteration.
- Hysteresis belongs in the trigger, not the target: repair when the deficit exceeds a threshold, but always repair to the full requirement.
- Disruption needs four numbers and a tier classification; a single scalar hides the difference between a nudge and a rebuild.

---

## Part II — The Test Layouts

A test layout earns its place by isolating one failure mode. The set below is arranged so that each algorithm has at least one layout where it is clearly right and one where it is clearly wrong. All are constructed programmatically, so they scale with the constraint settings rather than encoding a fixed pixel accident.

| Layout | Panes | Needs | Fits 1072×656 | Under min | Worst shortfall |
|---|---|---|---|---|---|
| HEALTHY | 4 | 586×268 | yes | 0 | — |
| SLIVER | 3 | 586×130 | yes | 2 | 137 px |
| FOUR DONORS | 4 | 784×130 | yes | 1 | 85 px |
| COMPOUND | 4 | 586×268 | yes | 2 | 129 px |
| SKINNY COL | 7 | 388×820 | **no** | 6 | 27 px |
| WIDE ROW 9 | 9 | 1774×130 | **no** | 9 | 78 px |
| STRIPES 6 | 6 | 190×820 | **no** | 6 | 27 px |
| DWINDLE 8 | 8 | 982×544 | yes | 5 | 172 px |
| SPIRAL | 7 | 784×544 | yes | 4 | 136 px |
| BSP 7 | 7 | 784×268 | yes | 0 | — |
| MASTER SWARM | 8 | 388×958 | **no** | 7 | 43 px |
| STACKS | 3 | 388×282 | yes | 1 | 13 px |
| MIXED MESS | 8 | 982×420 | yes | 4 | 151 px |
| TOO MANY | 35 | 1378×682 | **no** | 35 | 44 px |

Read the "Needs" column against the screen. Where the requirement fits but panes are still under minimum, the *distribution* of weights is wrong and weights can fix it. Where the requirement exceeds the screen, no weight assignment exists and the tree itself has to change.

### 2.1 Controls: HEALTHY and BSP 7

```js
HEALTHY: SP('h',[ P('MAIL'),
                  ST([P('CHAT'),P('TERM')],0),
                  SP('v',[P('DIFF'),P('LOG')],[.55,.45]) ],[.4,.3,.3])
```

Four visible panes, none in trouble, one of them a stack. The correct output for every algorithm is "do nothing," and the lab's proposal slate collapses to a single card reading *LEAVE AS IS +7 agree*. A repair system that fails this test — that rebalances a healthy desktop because it was asked to — is worse than no repair system, because it makes the layout unpredictable in exactly the situation where the user was happy.

`BSP 7` builds a balanced binary tree over seven panes with every split at 0.5. Seven is not a power of two, so leaf areas differ by a factor of two by construction, yet nothing violates its minimum. It separates "unequal" from "broken" — an algorithm that treats area variance as damage will attack this layout, and it should not.

### 2.2 The donor-choice layouts: SLIVER and FOUR DONORS

```js
SLIVER:      SP('h',[P('A'),P('B'),P('C')],[.90,.05,.05])
FOUR DONORS: SP('h',[P('A'),P('B'),P('C'),P('D')],[.30,.30,.30,.10])
```

Both are single rows with one oversized pane and one or more starved ones, and both are comfortably feasible. Their purpose is to expose *who pays*.

`SLIVER` has exactly one pane with slack. Every weight algorithm reaches the same answer, and the lab's geometry-deduplication merges them into one card — a useful result in itself: on this layout the choice of algorithm is irrelevant.

`FOUR DONORS` is the discriminating case. D needs 85 more pixels and three siblings can each afford it. This is the layout where L2 and sparse repair visibly disagree; §5 and §6 work it in full.

### 2.3 The compounding layout: COMPOUND

```js
COMPOUND: SP('h',[ P('A'),
                   SP('v',[ P('B'),
                            SP('h',[P('C'),P('D')],[.7,.3]) ],[.85,.15]) ],[.8,.2])
```

Three levels deep, with the damage at the bottom: D is 61×97. No single split is obviously wrong; the product of three reasonable-looking weights is not. This layout tests whether a repair escalates correctly across levels, and its trace (§4) shows the deficit being satisfied in three separate borrowings at three different depths.

### 2.4 The structurally impossible layouts: SKINNY COL, WIDE ROW 9, STRIPES 6, MASTER SWARM

```js
SKINNY COL:   SP('h',[P('BIG'), SP('v', 6 panes, eqw(6))],[.74,.26])
WIDE ROW 9:   SP('h', 9 panes, eqw(9))
STRIPES 6:    SP('v', 6 panes, eqw(6))
MASTER SWARM: SP('h',[P('MASTER'), SP('v', 7 panes, eqw(7))],[.84,.16])
```

A column of six panes needs `6·130 + 5·8 = 820` px of height. The screen has 656. The column is impossible regardless of what any weight does, and so is any layout containing it. `WIDE ROW 9` is the same argument along the other axis: `9·190 + 8·8 = 1774` px against 1072.

These four are the reason the algorithm set includes structural moves at all. Every weight-only algorithm applied to them either does nothing or shuffles pixels between panes that are all already too small. `STRIPES 6` adds a second dimension to the test: it is infeasible in height, and even after repair its panes have a 5:1 aspect ratio, which is the only case where the aspect term in `RELAX` and the aspect weight in the policy scorer change the outcome.

`MASTER SWARM` is the realistic version — a master pane at 84% with seven windows sharing the remaining 16%. It is the layout a dwm-style tiler produces on a laptop screen once the window count grows.

### 2.5 The identity-tracking layouts: DWINDLE 8 and SPIRAL

```js
DWINDLE 8: dw = (a,ax) => a.length===1 ? a[0]
                        : SP(ax,[a[0], dw(a.slice(1), other(ax))],[.62,.38]);
           dw(panes(8),'h')
```

Eight panes in a golden-ratio dwindle: each step gives 62% to the head and recurses into the remainder on the other axis. The tail panes shrink geometrically, and by the fifth level they are unusable — five of eight panes are under minimum, the worst by 172 px. The tree is a chain of seven binary splits, so it is also the deepest test case, and the one where "one weight moves everything downstream" is most visible.

`SPIRAL` is the same construction with the drop side alternating, which produces the classic spiral tiling and, more importantly, a tree where the *order* of children carries visual meaning. It is the layout where a reorder-class mutation (tier 3) is most likely to look wrong to a user even when it scores well.

Both layouts are feasible — 982×544 and 784×544 both fit — so weights alone can repair them. They exist to test whether you can still *find* your windows afterwards, which is why the lab colours panes by identity and draws their previous positions in the thumbnails.

### 2.6 The stack layout: STACKS

```js
STACKS: SP('h',[ SP('v',[ ST([P('IDE'),P('DOCS'),P('REF')],0), P('TERM') ],[.82,.18]),
                 ST([P('MAIL'),P('CAL')],0) ],[.7,.3])
```

This layout is barely broken — TERM is short by 13 px — and that is the point. The deficit exists only because a stack charges 14 px for its tab strip, so a stack of ordinary panes needs 144 px of height rather than 130:

```
stack needs { w: 190, h: 144 }   has 745×531
stack needs { w: 190, h: 144 }   has 319×656
violations: TERM dh=13
```

If your propagation forgets the tab strip, this layout reports clean and the repair never runs. It is a small test that catches a whole class of accounting bugs.

### 2.7 The realistic layout: MIXED MESS

```js
MIXED MESS: SP('h',[
  SP('v',[P('A'), SP('h',[P('B'),P('C')],[.86,.14])],[.72,.28]),
  SP('v',[SP('h',[P('D'), ST([P('E'),P('F')],0), P('G')],[.55,.35,.10]), P('H'), P('I')],[.5,.42,.08])
],[.62,.38])
```

Asymmetric, four levels deep, mixed axes, one stack, weights that are not round numbers, four panes broken with the worst 151 px short. This is what a desktop looks like after forty manual operations, and it is the layout on which algorithms that work beautifully on single rows start producing surprises. Use it to sanity-check anything before believing the single-split results.

### 2.8 The oversubscribed layout: TOO MANY

This one is computed from the current constraints rather than fixed, so it is always genuinely impossible:

```js
const cols = Math.max(2, Math.floor(rect.w/(cfg.minW+cfg.gap)) + 2);
const rows = Math.max(2, Math.min(6, Math.floor(rect.h/(cfg.minH+cfg.gap)) + 1));
const n    = Math.min(36, cols*rows);
```

At the reference configuration that is a 7×5 grid of 35 panes, needing 1378×682 against 1072×656. It deliberately overshoots capacity by two columns and one row, so no rearrangement can save it. It is the only layout in the set where the correct answer is to stop doing geometry and start hiding panes behind tabs (§11).

### 2.9 Key points for Part II

- A layout is a good test when it isolates one failure: wrong distribution, impossible topology, ambiguous donor choice, or oversubscription.
- Compare the "Needs" column against the screen to know in advance whether weights can possibly work.
- `HEALTHY` and `BSP 7` are controls: unequal is not the same as broken, and the correct output is no change.
- `FOUR DONORS` is the only layout where the L2-versus-sparse distinction is visible in a single split; use it to calibrate intuition.
- `TOO MANY` is computed from the live constraints so that it stays impossible no matter how the minimums are tuned.

---

## Part III — The Algorithms

Nine algorithms follow, ordered by how much they are willing to disturb. Each section states what the algorithm computes, why it exists, the mathematics, the implementation, a worked example with real numbers, its parameters, its cost, and where it fails.

---

## 3. DETECT — minimum-size propagation

**What it computes.** For every subtree, the minimum width and height it requires; for every visible pane, whether its rectangle clears the floor; for the root, whether the layout is globally feasible.

**Why it exists.** Every other algorithm needs to answer "how much does this child need?" before it can decide anything. Without propagation, a split can only see its own children's current sizes, which tells it nothing about what those children need. DETECT changes nothing and is not a repair; it is the measurement that makes repair possible.

### 3.1 The recurrence

For panes, `req = (minW, minH)`. For a row of children with requirements `q₁…qₙ`:

```
W = Σ qᵢ.w + (n−1)·gap
H = max qᵢ.h
```

For a column, transpose. For a stack over members `m₁…mₖ`:

```
W = max mᵢ.w
H = max mᵢ.h + tabH
```

The asymmetry between sum and max is the whole content of the recurrence. Along the split axis, children are laid end to end, so requirements add and gaps are real consumed pixels. Across the split axis, children overlap in extent, so requirements take the maximum. Getting this backwards produces a system that reports impossible layouts as fine.

### 3.2 Reading the output

The lab prints one line per split, comparing what it has to what its children need:

```
Row(2) has 1064px along x, children need 586px → 478px spare
· Col(2) has 648px along y, children need 268px → 380px spare
· · Row(2) has 380px along x, children need 388px → 8px SHORT
```

The third line locates the damage precisely: an inner row that is 8 px short. Note that the deficit reported at a split is not the deficit of any single pane — it is the aggregate over children, which is the quantity an ancestor has to supply.

### 3.3 Cost and behaviour

Linear in nodes with memoisation; 0.006 ms on an eight-pane tree. Run it on every change without thinking about it.

The one subtlety: `propagate` caches by node id, and the cache must be discarded whenever the tree changes shape. The lab builds a fresh memo per call for exactly this reason.

**Key points**

- Propagation converts a per-pane pixel floor into a per-subtree requirement that ancestors can act on.
- Sum along the axis, maximum across it; gaps count along the axis only.
- A stack's requirement is the maximum over its members plus the tab strip, because members share one rectangle.
- The global feasibility test is one comparison at the root, and it determines whether any weight-only algorithm can possibly succeed.

---

## 4. RIPPLE — local sibling borrowing

**What it computes.** For each split with a shortfall, a new weight vector obtained by transferring pixels from the nearest siblings that have slack, in order of distance, until each deficit is covered.

**Why it exists.** This is what a person does by hand. When one pane is too narrow, you drag the divider next to it. You do not rebalance the row. RIPPLE is the algorithm that produces the smallest visible change, measured in dividers rather than in pixels, and it is the correct default for automatic repair.

### 4.1 The procedure

At a split with pixel sizes `pxᵢ` and lower bounds `lowerᵢ`:

1. Compute deficits `need_i = max(0, lower_i − px_i)` and process them largest first.
2. For a deficient child `i`, rank all other children by `|j − i|` ascending, keeping only those with `slack_j = px_j − lower_j > 0`.
3. Take from each donor in turn, `min(want, slack_j)`, until the deficit is covered.
4. If donors run out, the split is locally infeasible: mark it and let the ancestor deal with it.

```js
const donors = px.map((p,j)=>({j, slack:Math.max(0,p-lower[j]), d:Math.abs(j-i), side:Math.sign(j-i)}))
  .filter(o=>o.j!==i && o.slack>0.5)
  .sort((a,b)=>{
    if(cfg.donorOrder==='slack') return b.slack-a.slack || a.d-b.d;
    if(a.d!==b.d) return a.d-b.d;
    return cfg.donorOrder==='left' ? a.side-b.side : b.side-a.side;
  });
```

The three donor orders are worth distinguishing. `nearest` minimises the number of dividers that move. `richest` minimises the *relative* damage to any one donor by taking from whoever can most afford it, at the cost of moving distant boundaries. `nearest, left first` exists because in left-to-right layouts users notice movement on the right less than on the left.

### 4.2 Worked example: cascading escalation on COMPOUND

The deficit at D is 129 px, but D's own row cannot supply it, and that row's parent cannot either. The trace shows three separate borrowings at three depths, each satisfying the *aggregate* requirement of the level below:

```
propagate minimums bottom-up: tree needs 586×268px, desktop 1072×656px
Row(2) ↔1064px — 1 child(ren) under minimum
  Col(2) short 175px — borrow from nearest siblings
    take 175px from A (slack 661) → satisfied
· Col(2) ↕648px — 1 child(ren) under minimum
  Row(2) short 33px — borrow from nearest siblings
    take 33px from B (slack 421) → satisfied
· · Row(2) ↔380px — 1 child(ren) under minimum
  D short 76px — borrow from nearest siblings
    take 76px from C (slack 76) → satisfied
```

Read the numbers carefully, because they explain the design. At the root, the deficient child is not D — it is the `Col` subtree, which needs 175 px more *in total*. The root has no idea D exists. It satisfies the aggregate, recurses, and the `Col` then discovers it is 33 px short in height for its own child row. Only at the third level does D's individual 76 px shortfall get addressed, and by then the space is already there.

The result:

```
before:  A 851×656   B 213×551   C 143×97   D 61×97
after:   A 676×656   B 388×518   C 190×130  D 190×130
Σ displacement 1065 px, largest single move 312 px, 0 violations
```

C's donation of exactly 76 px consumed all of its slack — `slack 76`, `take 76`. Had it been one pixel short, the split would have reported local infeasibility and the algorithm would have terminated with a violation, because RIPPLE at level three cannot go back and ask level one for more. This is the algorithm's principal weakness and it is discussed in §4.5.

### 4.3 Worked example: the donor choice on FOUR DONORS

D needs 85 px. C is adjacent and has 124 px of slack, so C pays the entire debt:

```
Row(4) ↔1048px — 1 child(ren) under minimum
  D short 85px — borrow from nearest siblings
    take 85px from C (slack 124) → satisfied
```

Weights go from `[.300 .300 .300 .100]` to `[.300 .300 .219 .181]`, that is `314 314 229 190` px. A and B do not move at all. Two panes changed, Σ displacement 256 px, largest single move 128 px. Compare against §5.3.

### 4.4 Parameters and cost

| Parameter | Effect |
|---|---|
| `donorOrder` | `nearest` (fewest dividers), `nearest, left first`, `richest` (spreads relative pain) |
| `hyst` | Deficit threshold before repair triggers at all |

Cost is `O(k²)` per split in the worst case (every child deficient, every other child scanned as a donor) and `O(k log k)` in the common case of one deficit. Measured at 0.12 ms for the eight-pane dwindle — the second cheapest algorithm in the set.

### 4.5 Failure modes

**Greedy exhaustion across levels.** The pass is single-shot and top-down. An ancestor satisfies the aggregate requirement of a subtree exactly, so if the distribution inside that subtree is unlucky, a deeper split can still run out. In practice this is rare because propagation computes the aggregate from the same minimums the deeper level will demand, but it is a real limit: RIPPLE has no backtracking.

**Order dependence.** Deficits are processed largest first. With two deficient children competing for the same donor, the smaller deficit gets whatever is left. The result is deterministic but not optimal.

**No global view.** Borrowing from the nearest donor can leave that donor at exactly its minimum while a pane two positions away sits on 400 px of slack. RIPPLE will not rebalance to fix that, by design.

**Key points**

- RIPPLE transfers pixels from the nearest sibling with slack, escalating only when the local split runs dry.
- Escalation happens through the recursion, not through a separate mechanism: an ancestor satisfies a subtree's aggregate requirement before descending into it.
- It moves the fewest dividers of any algorithm here, which is what makes it the right default for silent automatic repair.
- Its weaknesses are greed and order dependence; neither matters much on layouts with a healthy donor.

---

## 5. PROJECT — constrained L2 projection

**What it computes.** At each split, the feasible weight vector closest to the current one in Euclidean distance:

```
minimise  ‖w′ − w‖²
subject to  Σ w′ᵢ = 1,  w′ᵢ ≥ lᵢ
```

**Why it exists.** RIPPLE answers "which neighbour should pay?" with a heuristic. PROJECT answers a precisely stated question and returns the provably optimal answer to it. When you need a repair whose behaviour you can characterise mathematically — deterministic, order-independent, continuous in the input — this is it.

### 5.1 Solving it

The problem is a projection onto the simplex with lower bounds. Its Karush-Kuhn-Tucker conditions give a one-parameter solution family:

```
w′ᵢ = max(lᵢ, wᵢ + θ)
```

for a single scalar θ shared by all coordinates. The intuition behind the form: the equality constraint contributes one Lagrange multiplier, identical for every coordinate, which shifts every weight by the same amount; the inequality constraints activate only where that shift would push a weight below its floor, and there the weight sits exactly at the floor.

The sum `Σ max(lᵢ, wᵢ + θ)` is continuous and non-decreasing in θ, so θ can be found by bisection:

```js
function projectLower(w, l){
  const sl=sum(l);
  if(sl>=1-1e-9) return l.map(x=>x/sl);          /* infeasible: best effort */
  let lo=-1, hi=1;
  const F = th => sum(w.map((x,i)=>Math.max(l[i], x+th))) - 1;
  for(let k=0;k<80;k++){ const mid=(lo+hi)/2; if(F(mid)>0) hi=mid; else lo=mid; }
  const th=(lo+hi)/2;
  const out=w.map((x,i)=>Math.max(l[i], x+th));
  const s=sum(out);
  return out.map(x=>x/s);
}
```

Eighty bisection steps take θ to machine precision, and the final renormalisation absorbs the residual. An active-set method would converge in at most n steps instead of 80, but bisection is branch-free, has no degenerate cases, and at these sizes is not measurably slower.

The infeasible branch matters. When `Σ lᵢ ≥ 1` there is no feasible point at all, and the function returns `l / Σl` — the lower bounds scaled to fit. Every child is then proportionally short rather than a few being catastrophically short, which is the best available answer when the answer must be something.

### 5.2 Verification

```
projectLower([.5, .3, .2], [.25, .35, .10])  →  [.4750, .3500, .1750]
```

The second coordinate was below its floor and is pinned there exactly. The other two each gave up 0.025, which is `θ = −0.025`. The sum is 1. This is the textbook case: the shift is uniform among free coordinates, and constrained coordinates sit on their bounds.

### 5.3 Worked example: FOUR DONORS

```
Row(4) ↔1048px — 1 child(ren) under minimum
  min ‖w′−w‖²  s.t. Σw′=1, w′≥l   l=[.18 .18 .18 .18]
  [.30 .30 .30 .10] → [.27 .27 .27 .18]   (4/4 weights changed)
```

Exactly: `[.2723 .2723 .2723 .1830]`, or `286 286 286 190` px. D is pinned to its floor; A, B and C each surrender 28 px.

Now compare the two answers to the same problem:

| | A | B | C | D | Panes moved | Σ disp | Max move |
|---|---|---|---|---|---|---|---|
| before | 314 | 314 | 314 | 105 | — | — | — |
| RIPPLE / SPARSE | 314 | 314 | 229 | 190 | 2 | 256 px | 128 px |
| PROJECT | 286 | 286 | 286 | 190 | 4 | 341 px | 128 px |
| RELAX | 306 | 295 | 257 | 190 | 4 | 292 px | 128 px |
| BALANCE | 262 | 262 | 262 | 262 | 4 | 629 px | 236 px |

PROJECT is optimal for the question it asks and worse for the question the user is asking. Its objective is the L2 norm of the *weight* change, and the minimiser of an L2 norm spreads a correction across every free coordinate — that is what L2 does. The user's objective is closer to "how many boundaries visibly moved," which is an L0 count. Minimising L2 gives 4 panes moved and 341 px; minimising boundaries gives 2 and 256 px.

This is not a defect in the implementation. It is a mismatch between a mathematically natural objective and a perceptual one, and it is the reason §6 exists.

### 5.4 Parameters, cost, failure modes

No parameters. Cost is 80 evaluations of an `O(k)` function per split — 0.32 ms for the eight-pane dwindle, dominated by the bisection constant rather than by tree size.

Its failure mode is the one just described: it distributes change. On a wide row it produces the "everything moved by a little" result that reads as the whole layout shifting. It is also indifferent to distance — a pane at the far end of the row contributes to the correction exactly as much as the immediate neighbour.

**Key points**

- The constrained projection has a closed form: `w′ᵢ = max(lᵢ, wᵢ + θ)` for one scalar θ, found by bisection.
- It is deterministic, order-independent, and optimal for the L2 objective.
- L2 optimality is not perceptual optimality: it spreads a small correction over every sibling rather than concentrating it in one.
- When the lower bounds cannot be satisfied it returns them proportionally scaled, distributing the shortfall instead of failing.

---

## 6. SPARSE — fewest-donor repair

**What it computes.** The same repair as RIPPLE and PROJECT, under a different notion of "small": minimise the number of children whose size changes.

**Why it exists.** §5.3 showed the gap between minimising total change and minimising the number of things that change. The exact objective — minimise `Σ 1[Δᵢ ≠ 0]` — is combinatorial, and formulating it properly puts you in mixed-integer territory. The greedy version gets the same answer on the layouts that matter, for a few lines of code.

### 6.1 The procedure

For each deficient child, in order of decreasing deficit:

1. Look for a **single** donor with `slack ≥ want`. Among those, take the nearest. Done in one transfer.
2. If none exists, sort donors by slack descending and take greedily, which uses the fewest donors a greedy method can.

```js
const solo = cand.filter(o => o.slack >= want-0.5).sort((a,b)=>a.d-b.d)[0];
if(solo){
  px[solo.j] -= want; px[i] += want;
  yield {c:'grn', t:`  ${lab(node.ch[i])} short ${R0(want)}px → single donor ${lab(node.ch[solo.j])} pays all (dist ${solo.d})`};
  continue;
}
cand.sort((a,b)=> b.slack-a.slack || a.d-b.d);
```

The difference from RIPPLE is the primary sort key. RIPPLE sorts donors by distance and will happily use three of them; SPARSE sorts by capability and prefers one, falling back to the largest-slack donors so that the count stays low.

### 6.2 When it differs from RIPPLE

On `FOUR DONORS` they agree exactly, because the nearest donor is also able to pay in full. They diverge when the nearest donor is nearly exhausted:

```
Row(3): sizes [52, 207, 777], each needs 190

RIPPLE  takes 17 px from the neighbour, then 121 px from the far pane → 2 donors
SPARSE  takes all 138 px from the far pane                           → 1 donor
```

Both move the same set of dividers — in a flat row, taking from a distant donor still shifts every boundary between here and there — but SPARSE leaves the intermediate pane's *size* untouched and only translates it. Since displacement counts both position and size change, SPARSE scores slightly lower, and the intermediate window keeps its dimensions, which is what a user notices.

### 6.3 Cost and failure modes

Cheapest algorithm in the set at 0.086 ms, `O(k log k)` per split.

It is greedy, so it is not exactly minimising the donor count — a case exists where two medium donors beat one large one under some other criterion, and greedy will not find it. It also concentrates all the damage on one sibling, which is the right call when that sibling has room and the wrong call when the "damage" is large enough to be conspicuous. There is no threshold in the implementation that switches to spreading when the single donor would lose more than some fraction of its size; adding one is the obvious refinement.

**Key points**

- SPARSE minimises how many panes change size rather than how much total change occurs.
- One donor paying in full is preferred; the fallback takes from the largest-slack donors to keep the count low.
- On layouts with one obvious donor it coincides with RIPPLE, and the lab merges them into a single proposal.
- The exact minimum-count formulation is mixed-integer; greedy reaches the same answer on realistic layouts for a fraction of the machinery.

---

## 7. RELAX — projected gradient on a displacement energy

**What it computes.** A weight vector minimising a weighted sum of centre displacement, size displacement, and aspect-ratio error, subject to the same feasibility constraints, solved by projected gradient descent.

**Why it exists.** The previous three algorithms all optimise something about *weights*. What users perceive is rectangles: where they are and how large they are. RELAX optimises those quantities directly, and adds a term for a preference that has nothing to do with repair at all — panes that are not absurdly elongated. It is also the only algorithm here that runs on healthy splits, because aspect correction is not triggered by a violation.

### 7.1 The energy

For each child `i` of a split, with `cᵢ` the centre along the split axis and `sᵢ = wᵢ` the extent:

```
E(w) = Σᵢ  α·(cᵢ(w) − cᵢ⁰)²  +  β·(wᵢ − wᵢ⁰)²  +  γ·(log(aspectᵢ) − log(A*))² / 100
```

Centre and size are separate terms because they are separately perceptible. A pane that keeps its size but slides 200 px is a different event from a pane that stays put and grows 200 px, and α/β lets you say which one you mind more.

Centres are not independent of each other: `cᵢ = Σ_{j<i} (wⱼ + gap) + wᵢ/2`. Changing `w₀` moves every centre after it. This coupling is what makes the objective interesting rather than separable, and it is why the algorithm penalises changes at the front of a long row more heavily than changes at the back.

The aspect term uses the logarithm of the ratio so that 2:1 and 1:2 are penalised equally, and it is divided by 100 to bring it onto the same scale as the squared fractional displacements.

### 7.2 The solver

```js
let w = projectLower(w0, l);
const h = 1e-4;
for(let it=0; it<cfg.iters; it++){
  const g=[], e0=E(w);
  for(let i=0;i<n;i++){ const t=w.slice(); t[i]+=h; g.push((E(t)-e0)/h); }
  const gm = sum(g)/n;
  w = projectLower(w.map((x,i)=> x - cfg.step*(g[i]-gm)), l);
}
```

Three details carry the method:

**Start feasible.** The initial projection puts `w` inside the constraint set before the first step.

**Subtract the gradient mean.** `g[i] − gm` removes the component of the gradient that points off the `Σw = 1` hyperplane, so each step moves along the constraint surface rather than into it. Without this the projection would spend its effort undoing the step.

**Re-project after every step.** Any excursion below a lower bound is corrected immediately, using the same routine from §5. The whole method is "gradient step, project, repeat" — the standard projected-gradient scheme, and the reason §5 was worth implementing carefully.

The gradient is computed by finite differences. With `k ≤ 10` children and 60 iterations this is 600 evaluations of an `O(k)` function per split, which is fast enough, and it avoids differentiating the aspect term by hand.

### 7.3 Behaviour

With `γ = 0` and `α = β`, the energy is pure displacement and the answer is close to PROJECT's — on `FOUR DONORS`, `[.292 .281 .246 .181]` against PROJECT's `[.273 .273 .273 .183]`. Slightly better on displacement (292 px versus 341 px) because it weighs centre movement, which PROJECT ignores entirely: the panes nearest the damage give up more, since moving them disturbs fewer centres.

Raise `γ` and the behaviour changes qualitatively. On `STRIPES 6` — six full-width bands, every aspect ratio around 5:1 — the aspect term pushes weights toward whatever distribution best approximates the target ratio, on splits that had no violation at all. This is the only algorithm in the set that will change a layout that is not broken, which is why `stratRelax.always = true` and why it needs to be opt-in.

The `STACKS` example shows it doing minimal work correctly: TERM is 13 px short, and the repair takes 13 px from the sibling stack, for a total displacement of 40 px across two panes.

### 7.4 Parameters, cost, failure modes

| Parameter | Range | Effect |
|---|---|---|
| `α` centre | 0–4 | How much a pane sliding matters |
| `β` size | 0–4 | How much a pane resizing matters |
| `γ` aspect | 0–4 | Pull toward the target aspect ratio; nonzero makes it act on healthy splits |
| `iters` | 5–200 | Convergence; 60 is ample at these sizes |
| `step` | 0.01–0.3 | Step size; too large oscillates, too small under-converges |

At 3.6 ms it is thirty times more expensive than RIPPLE — still trivial in absolute terms, but it is the only algorithm whose cost is visible in the proposal slate when several variants run at once.

Failure modes are the usual ones for first-order methods. A step size that is too large oscillates around the constraint boundary; too small and 60 iterations do not converge, leaving weights that satisfy the constraints (the projection guarantees that) but do not minimise the energy. The finite-difference gradient adds noise at the 1e-4 scale, which is irrelevant here but would matter with a stiffer objective. And the energy is only a model of perception — tuning α, β and γ is empirical work, not derivation.

**Key points**

- RELAX optimises rectangle centres and sizes directly, rather than weights, and adds an optional aspect-ratio term.
- Centres are coupled through the cumulative sum, so the method naturally prefers to take space from panes near the damage.
- Projected gradient descent reuses the §5 projection as its projection step; subtracting the gradient mean keeps steps on the `Σw = 1` surface.
- A nonzero γ makes it act on splits that have no violation, which is a feature for tidying and a hazard for silent repair.

---

## 8. BALANCE — every split to 1/n

**What it computes.** `wᵢ = 1/n` at every split in the tree, followed by a feasibility projection if the equal division still violates a minimum.

**Why it exists.** As a command it is legitimate: "make everything even" is a thing users ask for deliberately. As a *repair* it is the baseline that every other algorithm should beat, and having it in the slate makes the cost of the others legible by comparison.

### 8.1 The implementation

```js
function* stratBalance(node, avail, lower, cfg, ctx){
  const n=node.ch.length;
  const w=eqw(n);
  const l=lower.map(x=>x/avail);
  if(cfg.balanceThenProject && w.some((x,i)=>x<l[i]-1e-9)){
    const p=projectLower(w,l);
    return p;
  }
  return w;
}
```

Note the composition: equalise, then project onto the feasible set only if equalising broke something. Equal division is not automatically feasible — in a row of nine panes on a 1072 px screen, `1/9` is 118 px against a 190 px floor, and every child is violated.

### 8.2 Why it is the wrong repair

On `FOUR DONORS`, BALANCE produces `262 262 262 262` px: Σ displacement 629 px, largest single move 236 px, against RIPPLE's 256 px and 128 px. It moved every pane in the tree to fix one 85 px deficit.

The deeper problem is that `stratBalance.always = true` — it visits every split, including the ones that were perfectly healthy. On `SKINNY COL` it rewrites both the outer row and the inner column, discarding the 74/26 master ratio the user chose, and it still cannot fix the column, because the column is impossible.

**Key points**

- BALANCE sets every split to `1/n` whether or not it was broken, so healthy regions of the layout change for no reason.
- Equal division is not automatically feasible; the optional projection afterwards restores feasibility when `1/n` falls below a minimum.
- Keep it as an explicit user command and out of the automatic repair path.
- Its value in the lab is as a control: it makes the disruption numbers of the other algorithms interpretable.

---

## 9. RESHAPE — local tree mutation search

**What it computes.** A small sequence of structural edits to the tree — transpose, rotate, reverse, swap, regroup — chosen by greedy hill-climbing on a scoring function, with each candidate's weights settled by a weight repair before it is scored.

**Why it exists.** Some layouts cannot be repaired by any weight assignment. A column of six panes on a 656 px screen needs 820 px; that is a property of the tree, not of the numbers in it. When the constraint violation is structural, the structure has to change, and the question becomes which change to make.

### 9.1 The mutation set

```js
for(const id of splits){
  out.push({k:'transpose', id});                       // Row ↔ Col
  if(node.ch.length>2){
    out.push({k:'rotate',  id});                       // children shift by one
    out.push({k:'reverse', id});                       // children reversed
    for(let k=2;k<=Math.min(4,node.ch.length-1);k++)   // regroup runs of k
      for(let s=0;s+k<=node.ch.length;s+=k)
        out.push({k:'regroup', id, s, run:k});
  }
  for(let i=0;i+1<node.ch.length;i++)
    out.push({k:'swap', id, i});                       // adjacent children
}
```

Each mutation is local, cheap, and reversible in kind, so the search space stays small and every candidate remains a legal tree. The important one is **regroup**: it takes `k` consecutive children of a split and wraps them in a sub-split on the *perpendicular* axis, which is the operation that turns a strip into a grid. A column of six that needs 820 px of height becomes, after regrouping two of them into a row, a column of five that needs 690 px.

Candidate counts are predictable. `DWINDLE 8` is seven nested binary splits, giving `7 × (1 transpose + 1 swap) = 14` candidates. `WIDE ROW 9` is one split with nine children: `1 transpose + 1 rotate + 1 reverse + 8 swaps + 9 regroupings = 20`.

After every mutation the tree is normalised, which flattens same-axis nesting and drops single-child nodes. This is what makes some mutations no-ops — regrouping children of a row into a row collapses straight back — and the search discards them naturally because their score does not improve.

### 9.2 The scoring function

```js
score = wViol·violations
      + wDeficit·(total shortfall px)/100
      + wAspect·Σ(log(w/h) − log(A*))²
      + wMove·(Σ displacement)/1000
```

Every candidate is settled with a weight repair (`project` by default) before scoring, so the comparison is structure against structure rather than structure against unsettled weights. This is the single most important detail in the algorithm: an unsettled candidate looks terrible for reasons that have nothing to do with its topology.

Displacement is measured against the *original* layout, not against the previous round, so a sequence of three mutations is charged for its cumulative disruption rather than its last step.

### 9.3 Worked example: SKINNY COL

```
start score 63.20   6 violations   16 candidates
round 1: 16 candidates → regroup 3 from slot 3   score 7.08   viol 0   move 3765
round 2: 17 candidates → regroup 2 from slot 0   score 4.99   viol 0   move 3233
round 3: 16 candidates → rotate children of n19  score 4.99   (gain below threshold) → stop
```

Round 1 does the real work: pulling three of the six column children into a row eliminates all six violations at once, since the column now needs `4·130 + 3·8 = 544` px instead of 820. Round 2 improves the score further without changing the violation count — it regroups another pair, which lowers the aspect penalty and, counter-intuitively, *reduces* total displacement from 3765 to 3233 px, because the new arrangement puts panes closer to where they started. Round 3 finds nothing worth 0.05 of score and stops.

The final tree, from `Row[BIG, Col[p1..p6]]`:

```
Row
├── BIG
└── Col
    ├── Row[p1, p2]
    ├── p3
    └── Row[p4, p5, p6]
```

Seven panes, zero violations, Σ displacement 3286 px.

### 9.4 Parameters, cost, failure modes

| Parameter | Effect |
|---|---|
| `inner` | Which weight repair settles each candidate: project, ripple, or sparse |
| `maxMoves` | Hill-climb rounds; 1 is a conservative single edit, 4 explores real restructuring |
| `minGain` | Score improvement required to accept a move; the stopping rule |
| `wViol`, `wAspect`, `wMove` | The trade-off between correctness, tidiness and stability |

Cost is `rounds × candidates × (clone + settle + score)`, which is `O(R·M·n)` with a large constant — 3.7 ms on the eight-pane dwindle, the most expensive algorithm in the set. It is still fast enough to run on every layout change, but it is the one that would need attention at forty panes.

The failure mode is the scoring function. Get the weights wrong and the search makes technically sensible moves that read as arbitrary: a swap that lowers displacement by 300 px but puts the terminal where the editor was is a bad trade no scalar captures. Greedy hill-climbing also stops at local optima; two mutations that are only good in combination will never be found, since each is rejected alone.

**Key points**

- Weight repair cannot fix a tree whose minimum requirement exceeds the screen; only structural change can.
- Regrouping consecutive children into a perpendicular sub-split is the mutation that converts an impossible strip into a feasible grid.
- Every candidate is settled with a weight repair before scoring, so topologies are compared fairly.
- The search is greedy with a minimum-gain stopping rule; its quality is entirely determined by the scoring weights, which are empirical.

---

## 10. REBUILD — regeneration with minimum-cost assignment

**What it computes.** A fresh layout tree from a chosen generator — grid, master, columns, rows, bsp, dwindle — with the existing panes seated into its slots by a minimum-cost assignment that minimises how far each window travels.

**Why it exists.** When the current topology is beyond repair, you generate a new one. The interesting part is not the generation; it is that a fresh tree has *slots*, and which pane goes in which slot is a free choice. Filling slots in depth-first order is arbitrary and scatters windows. Choosing the assignment that minimises total travel keeps the layout recognisable even though every rectangle changed.

### 10.1 The cost matrix

For pane `i` at rectangle `a` and slot `j` at rectangle `b`:

```
cost(i,j) = ‖centre(a) − centre(b)‖₂  +  sizeCost · (|a.w − b.w| + |a.h − b.h|)
```

Euclidean centre distance is the dominant term; the size term is a tie-breaker that prefers seating a large window in a large slot. `sizeCost` defaults to 0.25, which keeps size a secondary consideration.

### 10.2 The assignment problem

Minimise `Σᵢ cost(i, σ(i))` over permutations σ. This is the classical linear assignment problem, solved here by the Hungarian algorithm in its `O(n³)` shortest-augmenting-path form with potentials:

```js
function hungarian(cost){
  const n=cost.length, m=cost[0].length, INF=1e18;
  const u=Array(n+1).fill(0), v=Array(m+1).fill(0), p=Array(m+1).fill(0), way=Array(m+1).fill(0);
  for(let i=1;i<=n;i++){
    p[0]=i; let j0=0;
    const minv=Array(m+1).fill(INF), used=Array(m+1).fill(false);
    do{
      used[j0]=true; const i0=p[j0]; let delta=INF, j1=-1;
      for(let j=1;j<=m;j++) if(!used[j]){
        const cur=cost[i0-1][j-1]-u[i0]-v[j];
        if(cur<minv[j]){ minv[j]=cur; way[j]=j0; }
        if(minv[j]<delta){ delta=minv[j]; j1=j; }
      }
      for(let j=0;j<=m;j++){ if(used[j]){ u[p[j]]+=delta; v[j]-=delta; } else minv[j]-=delta; }
      j0=j1;
    } while(p[j0]!==0);
    do{ const j1=way[j0]; p[j0]=p[j1]; j0=j1; } while(j0);
  }
  ...
}
```

The potentials `u` and `v` maintain the invariant `cost(i,j) − u(i) − v(j) ≥ 0` with equality on the current matching, which is what makes the greedy augmenting path optimal rather than merely good. A sanity check against a hand-computable case:

```
cost = [[4,1,3],
        [2,0,5],
        [3,2,2]]
→ [1, 0, 2],  total 1 + 2 + 2 = 5
```

Rows are panes, columns are slots, and `n = m` always, since a slot is generated per pane.

### 10.3 Worked example: DWINDLE 8 into a grid

```
REGENERATE as GRID — the current topology is discarded
min-cost assignment over 8×8: Σcost 4349px vs 4658px in DFS order (−7%)
  A → slot 3  (341px)
  B → slot 2  (158px)
  C → slot 0  (783px)
  D → slot 5  (252px)
  E → slot 7  (313px)
  F → slot 1  (818px)
  G → slot 6  (943px)
  H → slot 4  (742px)
```

The assignment is not the identity — A, the largest pane in the dwindle, goes to slot 3 rather than slot 0, because slot 0's centre is closer to where C already sits. The saving over depth-first order is 7%.

Seven percent is a modest number, and it is worth being clear about why. When the target is a uniform grid and the source is a dwindle, every slot is roughly as far from every pane as any other, so the assignment has little room to work. The saving is larger when the target resembles the source. Across the four generators on the same layout:

| Target | Σcost vs DFS | Violations after | Σ displacement |
|---|---|---|---|
| grid | 4349 vs 4658 (−7%) | 0 | 8108 px |
| master | 2431 vs 2499 (−3%) | 7 | 4997 px |
| columns | 4638 vs 4748 (−2%) | 8 | 9334 px |
| dwindle | 0 vs 0 | 5 | 0 px |

The last row is the useful diagnostic. Regenerating a dwindle from a dwindle reproduces the input exactly — zero cost, zero displacement, and the original five violations, because generation does not consult the constraints. Only `grid` actually repairs this layout; `master` and `columns` produce new layouts that are just as broken as the old one. The lab greys those proposals out with "makes it worse."

### 10.4 Parameters, cost, failure modes

| Parameter | Effect |
|---|---|
| `target` | Which generator: grid, master, columns, rows, bsp, dwindle |
| `assign` | Hungarian assignment, or depth-first slot order for comparison |
| `sizeCost` | Weight of the size term relative to centre distance |

`O(n³)` for the assignment plus `O(n)` for generation; 0.44 ms at eight panes. At forty panes the cube starts to matter, but forty panes is already past the point where a fresh layout is a reasonable response.

The fundamental limitation is that it is not a repair at all. Every window moves; the tree the user built is gone. A generated grid also has no notion of importance — the editor and the notification window get equal area. Use it as a fallback, and prefer generators whose shape resembles what was there.

**Key points**

- Generation and seating are separate decisions, and the seating is where the disruption is decided.
- Minimum-cost assignment over centre distance keeps windows near where they were even though every rectangle changed.
- Generators do not consult the constraints, so a target can be as broken as the source; check the result before offering it.
- The saving over depth-first order is largest when the target shape resembles the source shape.

---

## 11. FOLD — surplus panes into stacks

**What it computes.** The number of usable rectangles the screen can hold at the current minimums, and, when there are more panes than that, a grid of tabbed stacks in which every *visible* pane clears its floor.

**Why it exists.** `TOO MANY` needs 1378×682 on a 1072×656 screen. There is no tree over 35 panes that fits. Every geometric algorithm has failed by definition, and the only remaining move is to stop showing all 35 panes at once.

### 11.1 The computation

```js
const cols = Math.max(1, Math.floor((rect.w+cfg.gap)/(cfg.minW+cfg.gap)));
const rows = Math.max(1, Math.floor((rect.h+cfg.gap)/(cfg.minH+cfg.tabH+cfg.gap)));
const cap  = cols*rows;
if(ps.length<=cap) return;                 // folding is not needed
const per = Math.ceil(ps.length/cap);
```

The `+cfg.gap` in the numerator accounts for there being one fewer gap than cells. The row calculation charges `tabH` per cell, because every cell is about to become a stack and the tab strip is real pixels.

At the reference configuration:

```
screen holds 5×4 = 20 usable rectangles, but there are 35 panes
fold into 20 stacks of up to 2 — every visible pane clears its minimum, the rest live behind tabs
```

`per = ceil(35/20) = 2`, which yields 18 groups (seventeen pairs and one singleton), laid out into rows of five. After folding: 18 visible panes, zero violations, Σ displacement 8876 px.

### 11.2 Why it is last

Folding is the only operation that changes what the user can see. Tiers 1 through 5 rearrange rectangles; tier 6 removes windows from view. That is categorically more disruptive than any amount of movement, which is why it sits at the end of the escalation ladder and why the `CAREFUL` and `TIDY` policies can forbid it outright.

It is also the only operation that is *guaranteed* to succeed. Given any pane count, there is a `per` large enough that the visible set fits. When it reports that panes still violate afterwards, the constraints themselves are impossible — the screen cannot hold even one pane at the stated minimum — and the honest response is a message rather than another algorithm:

> N panes still under minimum. Lower the floor, enlarge the screen, or close something — this is a report, not a failure.

**Key points**

- Capacity is `floor((w+gap)/(minW+gap)) × floor((h+gap)/(minH+tabH+gap))`, and the tab strip must be charged in the row term.
- Folding is the only repair that changes the visible pane set, which makes it categorically more invasive than any rearrangement.
- It always succeeds, because group size scales with pane count.
- If violations survive folding, the constraints are unsatisfiable and the correct output is a report to the user.

---

## 12. Composition — escalation and policy

The nine algorithms are not alternatives to choose between once. They form a ladder, and the interesting engineering is in how a system moves up it.

### 12.1 The escalation ladder

```
1. detect                 no violation → do nothing
2. local sibling borrowing        RIPPLE
3. constrained projection         PROJECT
4. local tree mutation            RESHAPE
5. regenerate                     REBUILD
6. fold into stacks               FOLD
```

Each stage runs only if the previous one left violations. The first stage is the one that matters most: on a healthy layout the correct behaviour is to do nothing, and it must cost nothing. A repair system that recomputes a layout it is not going to change is a system that will eventually change it by accident.

The stages are ordered by invasiveness, not by power. RESHAPE would fix `SLIVER` too, but RIPPLE fixes it by moving one divider, and there is no reason to restructure a tree that only needed 137 px moved from one pane to another.

### 12.2 Proposals instead of a decision

The lab does not run the ladder and apply the result. It runs *every* enabled generator, measures each, and presents the slate ordered by measured invasiveness. Three mechanisms make that presentation useful.

**Deduplication by geometry.** Results are keyed by the rounded rectangles of their visible panes. Algorithms landing on identical geometry merge into one card. On `SLIVER`, RIPPLE, SPARSE, PROJECT and RELAX all produce the same layout, and the merged card reports "+3 agree" — which is itself a finding: on this layout the choice does not matter. Generators that change nothing merge into the do-nothing baseline, so "RIPPLE had no effect here" is visible rather than silent.

**Policy gating.** A profile declares what the layout is permitted to do and what it may spend:

| Profile | Allows | Budget | Weights (move / struct / aspect) |
|---|---|---|---|
| CAREFUL | weights only | ≤2600 px | 1.6 / 6.0 / 0.1 |
| BALANCED | + reorder, reshape, fold | unbounded | 1.0 / 3.0 / 0.2 |
| TIDY | everything | unbounded | 0.25 / 0.3 / 1.6 |
| ANYTHING | everything | unbounded | 1.0 / 1.0 / 0.6 |

Proposals outside the policy remain visible, greyed, with the reason attached. Hiding them would leave the user with no way to understand why the system is not fixing an obvious problem.

**Recommendation.** Among in-policy proposals achieving the minimum violation count:

```js
polScore(p) = w.move·(Σdisp)/1000 + w.struct·tier + w.aspect·log(worstAspect) + 12·violations
```

Note that `tier` — the measured invasiveness class — enters the score directly. That is what makes `CAREFUL` with `w.struct = 6` prefer a mediocre weight repair over an excellent restructuring, and `TIDY` with `w.struct = 0.3` and `w.aspect = 1.6` prefer a rebuilt grid over a cheaper reshape. The same nine algorithms produce different recommendations under different policies without any algorithm knowing a policy exists.

### 12.3 Measured comparison

All figures at the reference configuration; Node timings averaged over 50 runs on `DWINDLE 8`.

| Algorithm | Tier reached | Cost | Time | Fixes structural infeasibility |
|---|---|---|---|---|
| DETECT | 0 | O(n) | 0.006 ms | no (measurement only) |
| RIPPLE | 1–2 | O(n·k) | 0.12 ms | no |
| SPARSE | 1–2 | O(n·k log k) | 0.086 ms | no |
| PROJECT | 2 | O(80·n) | 0.32 ms | no |
| RELAX | 2 | O(iters·n·k) | 3.6 ms | no |
| BALANCE | 2 | O(n) | 0.51 ms | no |
| RESHAPE | 3–4 | O(R·M·n) | 3.7 ms | yes |
| REBUILD | 5 | O(n³) | 0.44 ms | usually |
| FOLD | 6 | O(n) | 0.020 ms | always |

### 12.4 What to implement first

If you are adding repair to an existing tiler, the order is not the order of this document.

1. **Minimum-size propagation.** Nothing else is possible without it, it is thirty lines, and on its own it already lets you tell the user which pane is short and by how much.
2. **RIPPLE.** It fits the pair-preserving divider primitive most tilers already have, it is the least surprising repair, and it handles the large majority of real cases.
3. **PROJECT.** The principled fallback when local borrowing runs dry, and its projection routine is reused by everything that follows.
4. **RESHAPE**, but only after the first three are trustworthy, and only with a scoring function you have tuned against layouts you actually use.
5. **REBUILD and FOLD** as terminal fallbacks, behind an explicit user action rather than automatic escalation.

Separate the commands in your UI. "Balance" and "Repair" are different operations with different expectations, and conflating them is why `BALANCE` acquired its reputation as the thing that ruins your layout.

### 12.5 Key points for Part III

- Escalate by invasiveness, not by power: the cheapest repair that works is the correct one.
- Doing nothing must be a first-class outcome and must cost nothing, or the system will eventually disturb a layout that was fine.
- Deduplicating results by geometry turns "which algorithm" into "which outcome," which is the question the user actually has.
- Policy belongs outside the algorithms: the same nine generators serve every profile, and only the ordering and the gate change.
- Minimum-size propagation and local borrowing together cover most real repairs; everything above them is for the cases where the tree itself is wrong.
