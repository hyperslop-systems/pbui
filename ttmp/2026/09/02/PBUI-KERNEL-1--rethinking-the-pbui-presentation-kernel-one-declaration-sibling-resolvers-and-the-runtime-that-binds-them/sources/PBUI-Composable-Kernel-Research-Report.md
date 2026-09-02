---
title: "A Composable Presentation Semantics Kernel for PBUI"
subtitle: "Typed Relations, Binding Programs, and Identity Quotients"
author: "Research Engineering Technical Report"
date: "2 September 2026"
documentclass: report
classoption:
  - openany
fontsize: 10pt
papersize: letter
geometry:
  - top=0.72in
  - bottom=0.76in
  - left=0.78in
  - right=0.78in
mainfont: "Noto Serif"
sansfont: "Noto Sans"
monofont: "Noto Sans Mono"
colorlinks: true
linkcolor: "MidnightBlue"
urlcolor: "MidnightBlue"
toccolor: "black"
toc: true
toc-depth: 3
numbersections: true
header-includes:
  - |
    \usepackage{microtype}
    \usepackage{booktabs}
    \usepackage{longtable}
    \usepackage{array}
    \usepackage{fvextra}
    \usepackage{xcolor}
    \usepackage{fancyhdr}
    \usepackage{titlesec}
    \usepackage{enumitem}
    \usepackage{caption}
    \usepackage{float}
    \usepackage{amsmath,amssymb}
    \usepackage{stmaryrd}
    \definecolor{MidnightBlue}{RGB}{27,58,91}
    \definecolor{CodeBg}{RGB}{246,247,249}
    \DefineVerbatimEnvironment{Highlighting}{Verbatim}{breaklines,breakanywhere,fontsize=\small,commandchars=\\\{\}}
    \pagestyle{fancy}
    \fancyhf{}
    \fancyhead[L]{\small PBUI Composable Kernel}
    \fancyhead[R]{\small Technical Report PBUI-TR-2026-09-02}
    \fancyfoot[C]{\thepage}
    \setlength{\headheight}{14pt}
    \setlist{nosep,leftmargin=*}
    \captionsetup{font=small,labelfont=bf}
    \titleformat{\chapter}[hang]{\normalfont\huge\bfseries}{\thechapter}{1em}{}
---

# Abstract {.unnumbered}

PBUI has evolved several high-quality but separately introduced mechanisms for type-directed actions, acceptance and translation, contextual help, persistent tile linking, identity classes, and React runtime assembly. The two design tickets examined here, `PBUI-KERNEL-1` and `PBUI-LINK-1`, correctly identify the pressure created by duplicated declarations and by the need to model workbench connectivity as persistent semantics rather than incidental UI state. Their proposed designs are sound in their local domains. The remaining problem is conceptual fragmentation: translation, derived links, contextual contribution matching, and runtime binding are described as adjacent facilities even though they share deeper mathematical structure.

This report develops and implements a consolidated core. The central construction is a presentation semantics kernel built from one declaration and organized around four mathematical objects: a finite nominal type order; a contextual selector algebra; a registry of typed contextual partial functions, called relations; and a small binding-program language interpreted against a versioned world. Actions, help, acceptance, and linking remain sibling interpreters because their result algebras differ, but they consume shared type, predicate, context, and relation structures. Persistent `PBUI-LINK-1` terms remain wire-compatible. They are compiled into a normalized intermediate representation that factors atomic sources, relation application, and runtime control state. Directed dependency is separated from port identity, whose semantics are exposed as a quotient of compatible ports under the equivalence relation induced by identity declarations.

The implementation adds a canonical relation system with explicit finite composition, a one-declaration `PresentationKernel`, a shared predicate registry and selector, normalized binding programs, a static binding checker, dependency extraction, an identity quotient API backed by deterministic union-find, and a migration path through existing translator and `createPbui` interfaces. The change comprises 2,699 insertions and 226 deletions across 31 source files. The available strict TypeScript checks pass, the React assembly type-checks against typed stubs, and 188 pure presentation/link tests pass under a dependency-free compatibility runner. The official workspace package-manager and Go test commands could not run because the isolated environment lacked installed workspace dependencies and could not resolve external package/toolchain hosts. The report therefore distinguishes demonstrated properties from design claims and records the remaining validation work explicitly.

# Executive summary {.unnumbered}

## Research question {.unnumbered}

The practical question was not merely whether PBUI could place its existing registries behind one object. It was whether the presentation and link kernels could be reformulated so that the system has fewer primitive concepts, stronger laws, clearer failure behavior, and a migration path that does not destabilize already tested behavior.

The implementation answers that question affirmatively. The strongest consolidation is not a universal resolver. It is a shared semantic substrate over which several resolvers retain distinct policies.

The resulting system can be summarized as

$$
\mathcal{P} = (T, \preceq, \Sigma, R, C, I),
$$

where:

- $T$ is the finite set of nominal presentation types;
- $\preceq$ is subtype reachability over an acyclic graph;
- $\Sigma$ is the versioned contextual world observed by presentation decisions;
- $R$ is a finite registry of named contextual partial functions;
- $C$ is the set of contextual contributions, presently actions and help;
- $I$ is a family of interpreters: action selection, help accumulation, acceptance, and link evaluation/planning.

The link subsystem adds two further structures:

$$
\mathcal{L} = (E, D, Q),
$$

where $E$ is the binding-expression language, $D$ is its dependency interpretation, and $Q$ is the quotient of ports induced by compatible identity declarations.

## Principal findings {.unnumbered}

First, `PresentationTranslator` and a `Derived` link relation are the same kind of semantic arrow. Both are context-sensitive, typed, partial functions from one presentation reference to another. Modeling them canonically as relations eliminates an otherwise permanent adapter-shaped seam. Acceptance and linking still use those arrows differently: acceptance selects among results, while linking stores relation application as syntax and reevaluates it later.

Second, the `Binding` union in `PBUI-LINK-1` is best treated as a persistent surface syntax for a small program. The terms `Ambient`, `Constant`, `Follow`, and `Alias` denote sources; `Derived` denotes computation; `Hold` and `Unresolved` denote control/error state. Compiling this wire grammar into a factored intermediate representation makes dependency extraction, static type checking, normalization, evaluation, cycle detection, and future rewriting explicit compiler passes instead of verb-specific conditionals.

Third, identity is not another directed binding. `Follow(p)` creates a dependency edge. An identity declaration states that two compatible ports share one logical cell. The correct runtime model is therefore the quotient $P/{\sim}$, where $\sim$ is the equivalence closure of valid undirected declarations. The implementation preserves the existing `Alias` wire projection for compatibility but exposes `IdentityQuotient`, `compileIdentityQuotient`, and `logicalCellOf` so new code can reason in the proper model.

Fourth, one declaration should construct one immutable semantics kernel, but the resolvers must remain siblings. Actions choose one winning contribution per action identifier and preserve unavailable/hidden overrides. Help accumulates all matching items. Acceptance prefers substitutability and otherwise selects or exposes ambiguity among relations. Linking constructs, checks, stores, and evaluates programs. Their front halves share type, scope, predicate, and relation machinery; their back halves are different folds.

Fifth, revisions must be semantic tokens supplied by the product or caller. Deriving a revision by serializing arbitrary product facts confuses state equality with cache invalidation, adds work proportional to the facts object, and accidentally makes serialization behavior part of runtime semantics. The implemented kernel rejects snapshots without an explicit or product-derived revision.

## Implemented result {.unnumbered}

The implementation introduces the following core elements:

1. `PresentationSelector` and `matchSelector`, with `ContextTarget` and `matchContext` retained as compatibility names.
2. A single `PredicateRegistry` shared by actions, help, and relations.
3. `RelationSystem`, supporting validated direct relations and explicitly declared finite compositions, with no implicit path search.
4. `PresentationKernel`, built from one `PresentationKernelDeclaration` and exposing type graph, scopes, predicates, descriptors, actions, relations, help, snapshots, acceptance, link dependencies, vocabulary, and diagnostics.
5. A migration adapter from `PresentationTranslator` to direct relations and a compatibility branch in `createPbui`.
6. `BindingSource`, `BindingExpression`, and `BindingProgram`, plus lowering, normalization, and structural dependency extraction.
7. A static `checkBinding`/`checkProgram` layer that infers types, checks relation domains and destination compatibility, and performs dependency-cycle checks.
8. A detailed relation-evaluation path in the link world, preserving empty, unavailable, and error distinctions where available.
9. A factored `PortContract` surface through `ValueContract` and `PortProtocol` projections.
10. An identity quotient API backed by path compression and union by rank, with deterministic tie-breaking and persistent class-lineage assignment.

## What was deliberately not done {.unnumbered}

The implementation does not infer arbitrary conversion chains. Relation composition exists only when named explicitly. This avoids surprising acceptance behavior and combinatorial ambiguity.

The persisted `PBUI-LINK-1` grammar was not replaced. Existing documents remain representable, and normalized programs lower back to the stable terms. The new IR is an internal semantic form.

The legacy `createPbui({ registry, actions, snapshotFor, translators, help, ... })` path was not removed. A hard cutover would make the core change unnecessarily hostage to unrelated product migrations. The new kernel path is preferred and complete, while the old assembly is clearly marked as compatibility infrastructure.

The workbench UI, server validation, persistence migration, and every downstream consumer were not rewritten. This report concerns the core semantics and the minimum React assembly needed to consume it.

# Research setting and method

## Materials examined

The work began from the uploaded PBUI repository and two internal design tickets:

- `ttmp/2026/09/02/PBUI-KERNEL-1--.../design-doc/01-the-pbui-presentation-kernel-intern-analysis-design-and-implementation-guide-for-its-consolidation.md`
- `ttmp/2026/09/01/PBUI-LINK-1--.../design-doc/01-tile-linking-in-pbui-intern-analysis-design-and-implementation-guide.md`

The repository also contains the implemented action, help, translator, link, descriptor, workbench, and React runtime code to which those tickets refer. The external agent-workbench artifact supplied with the request was consulted as a contextual presentation of the running concept; its public shell exposed the workbench title but not enough static content to serve as an implementation source. The repository and ticket documents were therefore treated as authoritative.

The investigation was conducted as a design-and-build study rather than a speculative rewrite. The procedure was:

1. reconstruct the existing invariants from code and tests;
2. identify repeated mathematical structure beneath separately named facilities;
3. introduce the smallest canonical abstractions capable of expressing that structure;
4. preserve serialized forms and public compatibility paths where changing them was not necessary;
5. add law-oriented tests around the new abstractions;
6. run strict compilation and all pure tests available without fetching dependencies;
7. record both successful checks and environmental limitations.

## Evaluation criteria

The refactor was judged against seven criteria.

**Semantic compression.** A new abstraction is valuable only if several existing behaviors become instances of it without erasing important distinctions.

**Composability.** Independent declarations should combine through explicit, validated operations rather than registration order or hidden global state.

**Failure closure.** Unknown relations, incompatible types, absent scopes, failed predicates, invalid outputs, and ambiguous choices must produce explicit non-success results. The system must not guess.

**Fresh-state safety.** Planning information is advisory. Before an effect, the operation must be checked against current state.

**Persistence stability.** Core improvements should not invalidate link documents merely to obtain a cleaner internal model.

**Introspectability.** The same declaration should support runtime decisions, agent vocabulary, diagnostics, and explanations.

**Incremental adoption.** The repository should compile with old and new assembly styles while products migrate.

## Intellectual context

The design draws on several established ideas, but it is not a transcription of any one formalism.

Nominal subtyping is treated as substitutability rather than conversion, consistent with the separation between subtype polymorphism and coercion discussed by Cardelli and Wegner [1] and with behavioral substitutability as articulated by Liskov and Wing [2]. Contextual relations are represented as partial functions, a conventional denotational device associated with semantic descriptions of programming languages [3]. The one-declaration kernel follows information-hiding and representation-boundary principles associated with Parnas [4] and the system-description tradition represented by Lampson [5]. Binding programs borrow the compiler discipline of separating surface syntax, intermediate representation, static checking, and interpretation. Reactive evaluation remains pull-based, but the distinction between dependency structure and evaluation is related to functional reactive programming [6] and deterministic process-network models [7]. Identity classes use the disjoint-set algorithms analyzed by Tarjan [8]. Fresh revalidation parallels optimistic concurrency control: an operation planned against one state is accepted only after validation against the state on which it will act [9].

These references supply vocabulary and known properties. The PBUI-specific contribution is their combination around presentation references, contextual UI semantics, persistent link programs, and explicit refusal/ambiguity behavior.

# Problem statement

## The local correctness of the existing kernels

The starting system is not architecturally careless. Its individual components contain several strong decisions:

- the type graph is explicit and acyclic;
- action resolution is deterministic and ambiguity-aware;
- action availability remains in override competition instead of being discarded too early;
- help reuses contextual matching but accumulates rather than competes;
- acceptance distinguishes subtype satisfaction from conversion;
- linking persists declarations while keeping live values in runtime state;
- link plans are pure and effects are expressed as semantic verbs;
- values are evaluated by pull with revision-based memoization;
- identity classes have persistent identifiers and lineage;
- link operations re-plan against fresh state;
- the pure link kernel does not import React or browser globals.

The architectural problem is therefore not that these mechanisms are wrong. It is that they were introduced by successive tickets and retain the names and registry boundaries of their introduction history.

## Duplication at the declaration boundary

A product using the presentation system may need to construct or coordinate:

- a presentation type graph;
- a descriptor registry;
- a predicate map;
- an action registry;
- a help registry;
- a translator array;
- an acceptance resolver;
- link dependencies derived from graph and translators;
- a snapshot builder;
- vocabulary and diagnostics;
- a React runtime that binds all of the above to product facts and effects.

This is more than constructor boilerplate. It permits semantic drift. One consumer may use a predicate table that another omits. One may provide a different graph instance to the link planner. A translator may appear in acceptance but not in the relation palette. A snapshot revision policy may vary by call site. Introspection must reconstruct a system that was never declared as one system.

## Conceptual duplication beneath the registries

The deeper duplication is structural.

A translator declares a source type, target type, exact-or-subtype source matching, scopes, an optional condition, a priority, and an evaluation function. A derived-link relation needs the same information. Help and actions each declare a subject type, exact-or-subtype matching, scopes, conditions, and priority. Their result policies differ, but their applicability logic does not.

Without a canonical substrate, each facility must either duplicate fields or adapt another facility's fields. Adapters are useful during migration, but a permanent architecture whose core relation model is “whatever translators happen to expose” encodes historical accident.

## A hidden language in the link terms

The link ticket defines a union approximately of the form

$$
b ::= Ambient(k) \mid Constant(r) \mid Follow(p) \mid Alias(c)
       \mid Derived(b,\rho) \mid Hold(r,b) \mid Unresolved(d).
$$

This is an abstract syntax tree. `Derived` recursively contains another term. `Hold` preserves a suspended term. Evaluation is a recursive interpreter. Cycle checking depends on free port variables. Badges and inspectors are pretty-printers. Persistence is serialization. `pin` and `resume` are program transformations.

Treating this only as a list of binding states makes every new operation rediscover the language. Recognizing it as syntax allows PBUI to centralize compilation and analysis.

## Directed dependency and identity are not dual spellings

`Follow(q)` states that port $p$ reads from port $q$. It is directional and contributes an edge to a dependency graph.

An identity declaration states that ports $p$ and $q$ are views of one logical storage cell. It is symmetric, transitive, and constrained by protocol compatibility. Its closure partitions ports into equivalence classes.

Placing both concepts in a single “binding source” union is workable as a compatibility projection, but it obscures their different laws. A composable system must expose the quotient before evaluating directed expressions.

## Revision identity is not structural equality

A snapshot revision is used for memoization and fresh-state reasoning. It answers: “May a result computed under revision $r_1$ be reused under revision $r_2$?” This relation depends on which facts are semantically relevant to the computation.

Serializing the entire facts object answers a different question: “Are these serialized object graphs structurally equal under this serializer?” It may include irrelevant state, omit non-serializable state, cost linear time on every snapshot, and make canonical serialization part of the public performance model. The core therefore requires an explicit revision token or a declaration-level revision function.

# Design principles and invariants

The implementation follows the principles below.

## One semantic declaration, multiple interpreters

Products declare the type universe, scope universe, predicates, descriptors, actions, relations, help, and revision policy once. A builder validates and constructs immutable registries. Resolvers are not merged; they consume the same semantic assets.

## Subtyping is preservation, relations are computation

If a value of concrete type $A$ is accepted where $B$ is requested because $A \preceq B$, PBUI returns the original reference. It does not relabel it as $B$ or run a conversion. A relation is invoked only when computation is required.

## Ambiguity is data

When equally ranked acceptance relations produce multiple valid results, the resolver returns an ambiguous result containing the alternatives. Registration order is never a hidden tie-breaker.

## Composition is explicit

The relation system validates named finite compositions. It does not search the relation graph for a path. This gives the system an algebraic extension point without turning every accept or link gesture into an unbounded proof search.

## Surface syntax is stable; internal form may improve

Persisted `Binding` objects are not rewritten into a new document format. They compile to a normalized program and can be lowered back. Wire compatibility and mathematical clarity are not opposing requirements when an intermediate representation separates them.

## Planning is pure and application is conditional

A planner reads a snapshot and returns an available, unavailable, or ambiguous plan. Applying a verb must re-plan or otherwise validate against the world being mutated. Unavailable application has no persistent or runtime effect.

## Static structure and dynamic partiality are distinct

The binding checker can establish that an expression is well typed and acyclic. It cannot guarantee that a contextual relation returns a value in the current world. Relations are partial; a valid live program may evaluate to empty or unavailable as context changes.

## Identity is compiled before value lookup

Identity declarations induce logical cells. An alias term is a compatibility-level reference to such a cell, not an alternative form of directed following.

## Introspection uses the same declarations

Agent vocabulary, diagnostics, relation palettes, and UI explanations should be projections of the kernel, not manually synchronized metadata.

# Formal model

## Presentation types as a finite order

Let $T$ be the finite set of declared runtime presentation type identifiers. The type declaration graph is directed from a subtype toward its parent types and is validated to be acyclic. Define

$$
a \preceq b
$$

when $a=b$ or there is a directed path from $a$ to $b$.

Reachability is reflexive and transitive. Because the graph is acyclic, $a \preceq b$ and $b \preceq a$ imply $a=b$. Thus the implementation realizes a finite partial order over declared nominal nodes. It is still useful to speak of preorder semantics because consumers rely on reachability and may conceptually identify behaviorally equivalent nodes, but no nontrivial equivalence classes are permitted in the graph itself.

The graph also supplies a distance

$$
d(a,b) \in \mathbb{N} \cup \{\infty\},
$$

where finite distance is the shortest inheritance path from concrete type $a$ to declared ancestor $b$. Contextual matching records this distance as provenance. The current action resolver uses it as part of specificity behavior, while the shared selector itself only reports the fact.

Abstract types may organize contributions but are not legal relation targets in a complete kernel. This prevents a relation from promising a result that has no concrete descriptor contract.

## References

For a product value family $V$, a presentation reference is modeled as

$$
r = \langle t, v \rangle,
$$

where $t \in T$ and $v$ is a serializable or runtime value inhabiting the product-defined representation associated with $t$. The TypeScript form is indexed by a `PresentationValues` mapping, which gives the compiler a connection between type identifiers and values at authoring sites. Runtime checks still verify relation output type because JavaScript code and persisted data can violate static intentions.

## Context and snapshots

A presentation snapshot is

$$
\sigma = \langle rev, S, M, K, F \rangle,
$$

where:

- $rev$ is a string or finite number used as semantic invalidation identity;
- $S=[s_0,\ldots,s_n]$ is the active scope stack ordered inner-to-outer;
- $M$ is the set of active modes;
- $K$ is the set of capabilities;
- $F$ is the product-fact record.

The kernel validates that active scopes are declared and nonrepeating. The caller may override the revision per snapshot, or the kernel declaration may provide a function $rev(F)$. No structural default is supplied.

The implementation uses a unique-symbol marker for `SnapshotInput`. This allows a product callback to return either bare facts or a preconfigured snapshot input without relying on a string discriminator that could collide with an ordinary fact record.

## Contextual selectors

A selector is the tuple

$$
q = \langle a, m, U, c, p \rangle,
$$

where $a \in T$ is the declared subject type, $m \in \{exact,subtypes\}$ is the type-matching mode, $U$ is a set of declared scopes, $c$ is an optional declarative condition, and $p$ is a numeric priority.

For a reference $r$ of concrete type $t$ and snapshot $\sigma$, type matching is:

$$
TypeMatch(q,r) =
\begin{cases}
0 & m=exact \land t=a,\\
d(t,a) & m=subtypes \land t\preceq a,\\
\bot & \text{otherwise.}
\end{cases}
$$

Scope matching chooses the least index $i$ such that $s_i \in U$. An empty $U$ denotes a universal selector. When the active scope stack is itself empty, the implementation records a synthetic `__unscoped__` provenance scope for universal matching; kernel-built snapshots normally carry at least the declaration's scope sequence.

The condition $c$ is evaluated against the subject and snapshot using the one canonical predicate table. A match returns

$$
\langle a,t,d(t,a),s_i,i,p \rangle,
$$

which is reusable provenance rather than a Boolean. A rejection records whether type, scope, or condition failed.

Actions and help retain a stricter registration rule requiring explicit scopes because their existing override and placement contracts rely on scope ownership. Relations may use an empty scope list to mean globally applicable. The shared matcher supports both policies; each registry validates its domain-specific declaration constraints.

## Typed contextual relations

A direct relation declaration is a named contextual partial function

$$
\rho : Ref_A \times \Sigma \rightharpoonup Ref_B.
$$

It includes a selector whose declared subject is $A$ and a declared target $B$. The source rule is either exact or subtype-inclusive. For subtype matching, any $A' \preceq A$ may be supplied. If evaluation returns $r'$ with concrete type $B'$, the runtime enforces

$$
B' \preceq B.
$$

Returning no reference is a normal empty result, not an exception. Throwing is captured as an error result. A missing relation, failed selector, empty result, invalid result type, and thrown relation are distinguishable through `RelationEvaluation`.

This is intentionally a partial-function model rather than a general multi-valued relation. It matches the existing translator contract and keeps one relation identifier deterministic for one source and one world. Choice occurs among applicable named relations, not inside an individual relation. A future many-valued relation can be added as a separate cardinality without weakening the current laws.

## Explicit relation composition

For relations

$$
\rho_1 : A_0 \rightharpoonup A_1, \ldots,
\rho_n : A_{n-1} \rightharpoonup A_n,
$$

PBUI permits a named composition

$$
\rho = \rho_n \circ \cdots \circ \rho_1
$$

only when the declaration lists that exact finite step sequence. Adjacent endpoints must connect. If the next step uses exact source matching, the previous declared target must equal its source. If it uses subtype matching, the previous target must reach the next source through $\preceq$.

Registration rejects:

- empty compositions;
- unknown step identifiers;
- cycles in composition declarations;
- disconnected adjacent endpoints;
- abstract final targets when concrete targets are required.

At runtime, every step's selector is evaluated against the intermediate reference and the same snapshot. Any inapplicable or empty step makes the composition empty. Every intermediate output is checked against its step's declared target.

No path search is performed. Therefore the presence of $\rho_1:A\to B$ and $\rho_2:B\to C$ does not make an unnamed $A\to C$ conversion available. The product must declare a composition. This keeps vocabulary finite, names semantic intent, and prevents accidental coupling when a new relation is registered.

## Sibling interpreters as folds over matches

The shared semantic front half can be viewed as producing a stream of matched declarations with provenance:

$$
Match : Declaration \times Ref \times \Sigma \to Candidate^*.
$$

Each subsystem then applies a different algebra.

For actions, candidates with the same action identifier compete through the existing override rules. Availability participates in the competition, allowing a nearer unavailable or hidden contribution to suppress a fallback.

For help, matching contributions accumulate and are ordered for display. There is no “one winner per help identifier” law analogous to actions.

For acceptance, direct subtype satisfaction is attempted first. Otherwise relation results targeting one of the requested types are ranked by nearest active scope and then highest priority. One candidate is accepted; no candidates produce `none`; multiple tied candidates produce `ambiguous`.

For links, relation declarations are not immediately executed to select one result. Their identifiers become operators in stored programs, and evaluation occurs whenever the destination is read under a link world.

The resolvers therefore share machinery but not result semantics. A single universal resolver would need mode flags or an overly abstract monad to recover behavior that is clearer as explicit sibling folds.

## The persisted binding grammar

The stable `PBUI-LINK-1` wire grammar is retained:

$$
\begin{aligned}
b ::= {} & Ambient(k) \\
       \mid{} & Constant(r) \\
       \mid{} & Follow(p,\ell) \\
       \mid{} & Alias(c) \\
       \mid{} & Derived(b,\rho,\ell) \\
       \mid{} & Hold(r,b) \\
       \mid{} & Unresolved(d).
\end{aligned}
$$

Here $\ell$ is a persisted link identifier and $d$ is a diagnostic. This grammar is suitable for documents because it is compact, JSON-serializable, and already implemented by verbs and migration behavior.

Its constructors, however, mix three semantic categories: sources, computation, and control/error state.

## Normalized binding programs

The implementation compiles the wire grammar to the following internal language.

Atomic sources are

$$
s ::= Context(k) \mid Constant(r) \mid Port(p,\ell)
      \mid Cell(c) \mid Error(d).
$$

Expressions are

$$
e ::= Source(s) \mid Apply(\rho,e,\ell).
$$

Programs are

$$
P ::= Live(e) \mid Held(r,P) \mid Broken(d).
$$

This factoring yields a clean interpretation:

- source syntax identifies where an initial reference is obtained;
- `Apply` is the only computation constructor;
- `Held` freezes a value while retaining suspended behavior;
- `Broken` is terminal diagnostic state.

`programOf` compiles a persisted term. `bindingOf` lowers a program back to the persisted form. `normalizeBinding` is the round trip

$$
normalize(b) = bindingOf(programOf(b)).
$$

The implementation establishes idempotence by construction:

$$
normalize(normalize(b)) = normalize(b).
$$

A `Derived` whose source is a `Hold` is representable in the old recursive grammar but is noncanonical in the factored semantics. Only the held reference can participate in the outer computation, so compilation treats that source as a constant. Canonical link verbs already construct `Hold` around the complete suspended term, which preserves intended resume behavior.

![The stable binding grammar is compiled into a factored program IR.](figures/binding-ir.png){width=96%}

## Denotational evaluation

Let $W$ be a link world containing declared ports, explicit terms, identity classes, ambient values, document-slot values, runtime output values, relation semantics, and a presentation snapshot projection.

Expression evaluation is defined recursively. Representative equations are:

$$
\llbracket Source(Constant(r)) \rrbracket_W = r,
$$

$$
\llbracket Source(Context(k)) \rrbracket_W = Ambient_W(k),
$$

$$
\llbracket Source(Port(p)) \rrbracket_W = Read_W(p),
$$

$$
\llbracket Source(Cell(c)) \rrbracket_W = Cell_W(c),
$$

and

$$
\llbracket Apply(\rho,e) \rrbracket_W =
  R_W(\rho,\llbracket e \rrbracket_W).
$$

Program evaluation is

$$
\llbracket Live(e) \rrbracket_W = \llbracket e \rrbracket_W,
$$

$$
\llbracket Held(r,P) \rrbracket_W = r,
$$

$$
\llbracket Broken(d) \rrbracket_W = Error(d).
$$

The suspended program in `Held` is intentionally not evaluated. Changes upstream do not affect the held value. `resume` restores the suspended term, giving the important law

$$
resume(pin(b)) = b
$$

for effective bindings under stable link identity.

The evaluator remains pull-based. Reading a destination recursively reads dependencies and applies relations. Existing per-revision memoization and cycle diagnostics remain the runtime strategy; the refactor does not introduce a push scheduler.

## Static typing of binding programs

The checker operates with a type environment derived from the link snapshot and relation definitions. Its judgment has the form

$$
\Gamma;R \vdash e : A.
$$

Selected rules are:

$$
\frac{Ambient_W(k):A}{\Gamma;R \vdash Context(k):A}
\qquad
\frac{type(r)=A}{\Gamma;R \vdash Constant(r):A}
$$

$$
\frac{contract(p).valueType=A}{\Gamma;R \vdash Port(p):A}
\qquad
\frac{cell(c):A}{\Gamma;R \vdash Cell(c):A}
$$

$$
\frac{\Gamma;R \vdash e:A' \quad A' \mathrel{match_\rho} A
      \quad \rho:A\to B}
     {\Gamma;R \vdash Apply(\rho,e):B}.
$$

For an exact relation source, $A'=A$. For subtype matching, $A'\preceq A$. The checker validates relation existence, source compatibility, destination compatibility, and unresolved/broken states. A held program's result type is the type of the frozen reference; its suspended dependency structure is still available for operations that need restoration semantics.

The checker proves structural admissibility, not current totality. A contextual relation may be well typed yet return empty under the present facts. This separation permits a link to remain a valid reactive declaration even when current data does not produce a value.

## Structural dependencies and cycles

Define the free port dependencies $D_P$ recursively:

$$
D_P(Context(k)) = D_P(Constant(r)) = D_P(Cell(c)) = \varnothing,
$$

$$
D_P(Port(p,\ell)) = \{p\},
$$

$$
D_P(Apply(\rho,e,\ell)) = D_P(e).
$$

The implementation also extracts relation identifiers and link identifiers, yielding a triple of finite sets. For `Held`, suspended dependencies are included by default because they matter to resume, inspection, invariant checks, and eventual cycle safety; callers may explicitly exclude them when reasoning only about the currently active frozen value.

The link dependency graph has ports as vertices and an edge $p\to q$ when the effective live program of $p$ reads $q$. A proposed binding for destination $d$ is rejected when insertion would make $d$ reachable from one of its dependencies. Cycle checks are therefore based on expression structure, not duplicated separately for `follow` and `derive` verbs.

## Port values and protocols

The original `PortContract` combines value compatibility with communication behavior. The implementation factors its fields conceptually into:

$$
PortContract = ValueContract \times PortProtocol.
$$

`ValueContract` contains presentation value type, semantic role, and cardinality. `PortProtocol` contains mode, authority domain, update algebra, and lifetime. The public `PortContract` continues to extend both, preserving call sites, while `valueContractOf` and `portProtocolOf` make the distinction available to compatibility algorithms and future APIs.

This matters because operations require different notions of compatibility. Acceptance or binding may care principally about value reachability. Identity must ensure that two ports can safely denote one cell, so the relevant protocol fields must agree. The existing identity fingerprint remains based on the seven normalized fields; the factorization makes that policy explicit rather than silently coupling all future operations to it.

## Identity as a quotient

Let $P$ be the set of declared ports eligible for shared state. Each identity declaration is an undirected edge $(p,q,\ell)$. An edge is admitted only when both ports exist, neither is output-only, and their identity contracts have the same normalized fingerprint.

Let $E$ be the admitted edge set. Define $\sim$ as the reflexive, symmetric, transitive closure of $E$. Then the logical storage cells are the equivalence classes

$$
Q = P/{\sim}.
$$

The compiler constructs connected components separately within each compatibility fingerprint fiber. Invalid declarations produce diagnostics and do not enter the equivalence relation.

The implementation uses disjoint-set union with path compression and union by rank. Equal-rank ties use lexical root order, so the raw forest construction is deterministic. Components and members are sorted canonically. Persistent class identifiers are then assigned by maximum overlap with previous classes, with lexical tie-breaking, preserving the prior ticket's lineage behavior across merges, splits, expansions, and contractions.

The exported `IdentityQuotient` contains:

- `cells`, the logical equivalence classes;
- `cellByPort`, the quotient map $P\to Q$ for participating ports;
- `lineage`, describing how class identities changed;
- `diagnostics`, for rejected declarations.

`logicalCellOf(p,q)` resolves a port to its cell. The existing `CompiledIdentity.aliases` map and persisted `Alias(classId)` term remain available as compatibility projections.

![Identity declarations induce connected components and then logical quotient cells.](figures/identity-quotient.png){width=98%}

## Plan, revalidate, apply

For a semantic verb $v$ and world $W$, planning is a pure function

$$
plan(v,W) \to Available(p) \mid Unavailable(d) \mid Ambiguous(O).
$$

Application is permitted only when the verb is available in the world being mutated. In practice the link verb handler re-plans against a fresh snapshot before producing document and runtime effects. The React presentation runtime likewise re-resolves actions before routing a verb and can report a fresh-state refusal through `onRefuse`.

The intended law is:

$$
plan(v,W) \ne Available \implies apply(v,W)=NoEffect.
$$

A previously rendered menu row or drag target is not authority. It is a cached proposal whose assumptions may have expired.

![Operations are proposed from one snapshot and revalidated before effects.](figures/plan-apply.png){width=96%}

# System architecture

## One declaration

The preferred product-facing declaration is represented by `PresentationKernelDeclaration<Values, Environment, ProductFacts, Verb>`. It contains:

- presentation type definitions;
- declared scopes;
- predicate definitions;
- descriptor map;
- action contributions;
- canonical relation declarations, or migration-only translators;
- optional help contributions;
- revision function;
- version token.

The constructor rejects a declaration that supplies both relations and translators. Translators are converted to direct relation declarations through `relationFromTranslator`. The resulting kernel always exposes a relation system, so downstream code does not branch on whether a product has migrated.

A representative declaration is:

```ts
const kernel = createPresentationKernel({
  version: 2,
  types: [
    { id: "entity", abstract: true },
    { id: "order", parents: ["entity"] },
    { id: "customer", parents: ["entity"] },
    { id: "account", parents: ["entity"] },
  ],
  scopes: ["tile", "workspace"],
  predicates: [
    {
      id: "order-has-customer",
      evaluate: ({ subject, snapshot }) =>
        subject.type === "order" &&
        snapshot.product.orders.has(subject.value),
    },
  ],
  descriptors,
  actions,
  relations: [
    {
      id: "order.customer",
      label: "customer of order",
      from: "order",
      to: "customer",
      match: "exact",
      scopes: ["workspace"],
      when: { predicate: "order-has-customer" },
      apply: (order, snapshot) => lookupCustomer(order, snapshot.product),
    },
    {
      id: "customer.account",
      from: "customer",
      to: "account",
      match: "exact",
      scopes: ["workspace"],
      apply: (customer, snapshot) => lookupAccount(customer, snapshot.product),
    },
    {
      id: "order.account",
      kind: "composition",
      label: "billing account of order",
      steps: ["order.customer", "customer.account"],
    },
  ],
  help,
  revision: facts => facts.revision,
});
```

The composition is visible, named, and introspectable. Merely declaring the two direct relations would not make `order.account` available.

## Constructed kernel

`createPresentationKernel` constructs and exposes:

```ts
interface PresentationKernel<Values, Environment, ProductFacts, Verb> {
  version: string | number;
  graph: PresentationTypeGraph;
  scopes: readonly ScopeId[];
  predicates: PredicateRegistry<Values, ProductFacts>;
  descriptors: PresentationDescriptorRegistry<Values, Environment>;
  actions: ActionRegistry<Values, ProductFacts, Verb>;
  relations: RelationSystem<Values, ProductFacts>;
  help: HelpRegistry<Values, ProductFacts> | null;

  snapshot(facts: ProductFacts, options?: SnapshotOptions): SelectionSnapshot<ProductFacts>;
  accept(request, reference, snapshot): AcceptanceResolution<Values>;
  linkDeps(options: LinkDependencyOptions<ProductFacts>): LinkDeps;
  vocabulary(): PresentationVocabulary;
  diagnostics(): readonly KernelDiagnostic[];
}
```

This object is not a service locator assembled from arbitrary mutable registries. It is the validated semantic value produced from one declaration. Consumers may still call narrow methods and pass narrow dependencies, but those dependencies derive from the same source.

![One declaration constructs shared semantic assets consumed by sibling interpreters.](figures/architecture.png){width=99%}

## Shared predicate ownership

Before the change, action and help registries could each build their own predicate map. The new `createPredicateRegistry` creates one immutable table. Action, help, and relation constructors accept either raw predicate definitions or an already prepared registry, but reject supplying both. The kernel always passes the same prepared table.

Registration-time `validateConditionPredicates` reports an owner-specific error for unknown predicate identifiers. This catches spelling and assembly errors before resolution.

A law test verifies that relation matching evaluates a selector predicate once. `matches` first computes applicability and then executes the relation with the captured match rather than invoking the selector again. This matters because predicates should be observationally pure, but duplicate evaluation would still impose needless cost and complicate diagnostics.

## Shared selectors without a universal resolver

`PresentationSelector` is the first-class applicability record shared across interpreters. `ContextTarget` remains a type alias and `matchContext` remains an exported alias for compatibility.

The separation is intentionally at the correct layer. The matcher owns type reachability, nearest active scope, declarative condition evaluation, and match provenance. It does not own action override competition, help accumulation, acceptance ranking, or link planning.

This follows an information-hiding rule: share a module around a stable design decision, not around coincidental code shape. The stable decision is what it means for a typed declaration to apply in a context. The unstable and domain-specific decisions are what to do with several matches.

## Relation system API

`RelationSystem` exposes both declaration-level and execution-level views:

- `has` and `get` for identifier lookup;
- `list` for prepared executable relations;
- `definitions` for serializable/introspective metadata;
- `applicable` for selector matches without relation execution;
- `matches` for successful evaluated relation results;
- `evaluate` for detailed value/empty/unavailable/error outcomes;
- `apply` as a convenience projection to value-or-undefined.

This distinction avoids forcing every consumer into the lowest-common-denominator callback. A relation palette may need definitions. Acceptance needs successful matches and provenance. Diagnostics need detailed errors. A link evaluator needs a serializability boundary after execution.

## Acceptance over relations

`resolveAcceptance` now accepts either a `RelationSystem` or the legacy graph/translators tuple. The kernel uses the relation branch.

The algorithm is:

1. Normalize the request's accepted type or types.
2. If the source type reaches any requested type, return the original reference, subject to the request filter.
3. Otherwise ask the relation system for successful matches whose declared targets reach a requested type.
4. Recheck the actual output type and request filter.
5. Retain candidates in the nearest active scope.
6. Retain candidates with maximum priority.
7. Return one accepted candidate or a lexically ordered explicit ambiguity.

The public `AcceptanceOption.translator` field remains named for compatibility, but its non-null value is now semantically a relation identifier. This is documented in the type.

## Link dependency projection

The link kernel remains a pure sibling package with a narrow `LinkDeps` interface. `kernel.linkDeps` projects the canonical relation definitions and provides an evaluator that maps a `LinkSnapshot` into the product's `SelectionSnapshot` through a caller-supplied function.

This boundary performs an additional critical check: relation results used by link documents must be serializable presentation references. A runtime relation may be useful to an action or acceptance path yet produce a value unsuitable for persistence or cross-tile transport. The link projection converts such a result into a diagnostic rather than admitting it.

The projection also accepts an optional reference-label function. The link engine therefore does not depend directly on the descriptor registry or environment, preserving purity.

## Snapshot construction

`kernel.snapshot(facts, options)` validates active scopes, materializes mode and capability sets, and selects a revision from `options.revision` or the declaration's revision function. Missing, nonfinite revisions fail immediately.

The `definePresentation` helper supplies a typed `snapshotInput` constructor carrying the unique symbol marker. This lets `createPbui` accept:

```ts
factsFor(query, environment) {
  return presentation.snapshotInput(readFacts(), {
    scopes: scopesFor(query),
    modes: activeModes(),
    capabilities: capabilitiesOf(environment),
    revision: store.revision,
  });
}
```

or simply return facts when the declaration supplies all defaults.

## React assembly and fresh refusals

`createPbui` now has two option families.

The preferred family takes `kernel`, `factsFor`, and runtime rendering/effect options. It resolves descriptors, actions, acceptance, and help through the kernel.

The compatibility family takes the former `registry`, `actions`, `snapshotFor`, optional translators, and optional help registry. Existing callers continue to type-check.

The Provider now accepts `onRefuse`. When a rendered action is re-evaluated against fresh state and is no longer performable, the runtime can report a structured refusal containing code, explanation, action/candidate identifiers, and subject. Omitting the callback preserves prior silent behavior.

This is a small but important systems property: the UI may display proposals from an earlier render, but product telemetry and agent integrations can observe why an attempted operation did not cross the effect boundary.

# Link-program implementation

## Compiler boundary

`programOf(binding)` is now the central entry from persisted terms into semantic analysis. The evaluator, checker, dependency extractor, and future inspector can operate on the same normalized form.

The reverse `bindingOf(program)` means the IR is not a one-way migration. It can support normalization tools, document repair, or future optimization while preserving the wire grammar.

The compiler intentionally preserves link identifiers on port sources and relation applications. These identifiers are part of document provenance and undo lineage, not merely decorative metadata.

## Evaluation outcomes

The previous link relation callback could return a reference or `undefined`. `LinkDeps` now optionally exposes `relationEvaluation`, whose result distinguishes:

- a value;
- an ordinary empty relation result;
- a diagnostic error.

The evaluator uses the detailed path when present and retains the older callback as compatibility behavior. This avoids turning every contextual absence into a generic “relation failed” error and provides a route for relation-system diagnostics to reach badges, inspectors, and agent responses.

## Candidate checking in planners

Link planning constructs the same candidate term that would be persisted and asks the checker to validate it against the destination. This reduces the semantic gap between “plan follow,” “plan derive,” and future compound operations.

The checker returns the normalized program, inferred result type, and complete structural dependency sets on success. On failure it returns a code and message for unresolved terms, missing ambient/source/class/relation entries, relation-domain mismatch, destination type mismatch, or cycle.

Some existing planner-specific policy remains outside the generic checker, appropriately. A document-slot port cannot be rebound through ordinary link verbs. Directionality, already-linked state, and operation-specific user explanations remain planner concerns.

## Invariant checking

Link invariant checking now examines all non-suspended source dependencies rather than assuming a term contains at most one source port. This matters once relation application is treated recursively and prepares the system for future expression constructors.

Suspended dependencies are treated carefully. A held binding does not currently read its upstream ports, but its suspended program must remain inspectable and capable of safe restoration. APIs therefore make `includeSuspended` explicit rather than embedding one universal definition of dependency.

## Port-contract projections

`ValueContract` and `PortProtocol` are additive types. Existing declarations need no migration. The projections provide a stable vocabulary for future work:

```ts
const value = valueContractOf(port.contract);
const protocol = portProtocolOf(port.contract);
```

A likely next step is to define operation-specific compatibility functions such as `canFlow`, `canAlias`, and `canAccept`, each stating which value and protocol dimensions it uses. The current change stops before redefining established identity compatibility.

## Identity quotient API

The quotient API is a semantic view over the existing identity compiler, not a second implementation. `identityQuotientOf` maps compiled classes, aliases, lineage, and diagnostics into cell terminology. `compileIdentityQuotient` is a convenience constructor. `logicalCellOf` performs the quotient lookup.

The underlying union-find implementation was strengthened with path compression and union by rank. For $m$ operations on $n$ elements, the classic amortized bound is $O(m\alpha(n))$, where $\alpha$ is the inverse Ackermann function [8]. PBUI's port sets are small enough that almost any correct method would be fast; the benefit is principally a standard, well-understood algorithm and a clear law surface.

A new test confirms that edge order and duplicate union declarations do not change the quotient cells. Persistent class identifier assignment remains dependent on the supplied previous classes by design, but the partition itself is order-independent.

# Source-level implementation map

Table 1 summarizes the primary code changes.

| Area | Files | Result |
|---|---|---|
| Shared context | `context/types.ts`, `context/match.ts`, `context/predicates.ts` | First-class selector, one predicate registry, compatibility aliases |
| Relations | `relations/types.ts`, `system.ts`, `define.ts`, `adapters.ts`, `index.ts` | Canonical typed partial functions, explicit composition, introspection, translator adapter |
| Kernel | `kernel/types.ts`, `create.ts`, `define.ts`, `index.ts` | One declaration, snapshot policy, sibling registries, vocabulary, diagnostics, link projection |
| Acceptance | `translators/resolve.ts`, `types.ts` | Relation-system path plus legacy translator path |
| Link IR | `links/expression.ts` | Wire grammar compiler, normalized program, lowering, normalization, dependencies |
| Link checker | `links/check.ts` | Type inference, relation-domain check, destination check, cycle check |
| Link evaluator | `links/evaluate.ts`, `snapshot.ts` | Program interpretation and detailed relation outcomes |
| Link planners/invariants | `links/plan.ts`, `invariants.ts` | Candidate-based checking and generalized dependency analysis |
| Ports | `links/types.ts` | Value/protocol factorization and projections |
| Identity | `links/identity.ts` | Deterministic optimized union-find and explicit quotient API |
| Runtime | `createPbui.tsx` | Kernel assembly, symbol-marked snapshot inputs, fresh refusal callback, legacy compatibility |
| Public exports | `presentation/index.ts`, `links/index.ts`, subsystem indexes | New APIs available from package surfaces |
| Tests | four new test files plus existing suites | Relation, kernel, IR, quotient, and algebraic coverage |

The change is intentionally concentrated in `src/presentation`. No workbench store, server package, product application, CSS, or generated protocol was modified.

# Compatibility and migration

## Translator compatibility

A legacy `PresentationTranslator` is structurally converted into a direct relation:

- `id` becomes relation identity;
- `from`, `to`, `match`, `scopes`, `when`, and `priority` are preserved;
- `translate` becomes `apply`.

Products may therefore move first to `PresentationKernelDeclaration.translators` without rewriting their callbacks, then rename and enrich declarations as relations later. The kernel prevents simultaneously supplying both arrays, avoiding duplicate semantic identifiers.

## Acceptance compatibility

The standalone `resolveAcceptance` accepts both old and new option shapes. Existing tests and consumers can continue to call it with graph, translator array, and predicates. Kernel consumers receive the same public `AcceptanceResolution` shape.

The remaining field name `translator` in `AcceptanceOption` is a compatibility debt. Renaming it immediately would cause a wide mechanical change without semantic benefit. A future major version can introduce `relation` while accepting a deprecated alias.

## Binding-document compatibility

No persisted term kind was removed or renamed. `Alias` remains readable and writable. `programOf` and `bindingOf` make the new semantics internal.

This choice is especially important because link identifiers, hold/resume behavior, document-slot fallbacks, and unresolved diagnostics already have tests and likely persisted examples. A report about mathematical elegance should not mistake gratuitous storage churn for progress.

## Runtime compatibility

`createPbui` uses a discriminated option union at the property level: an options object supplies either `kernel` and `factsFor`, or the legacy registries and `snapshotFor`. The returned runtime includes the kernel when constructed through the new path.

Fresh-refusal reporting is optional. Existing products preserve behavior until they add telemetry or user feedback.

## Recommended migration sequence

A low-risk product migration is:

1. Wrap existing types, scopes, predicates, descriptors, actions, translators, and help in a `PresentationKernelDeclaration` using the translator compatibility field.
2. Replace manual snapshot construction with `kernel.snapshot` or `snapshotInput` and give the product an explicit semantic revision.
3. Pass the kernel to `createPbui` and remove independently assembled registries from that call site.
4. Replace translator declarations with relation declarations, retaining identifiers.
5. Add explicit named compositions only where product semantics requires them.
6. Construct link dependencies through `kernel.linkDeps`.
7. Adopt detailed relation diagnostics, quotient terminology, and program introspection in workbench inspectors.
8. Remove the legacy `createPbui` and translator branches only after all products have migrated and compatibility tests are frozen.

# Laws and test strategy

## Algebraic laws

Scenario tests remain necessary for user-visible behavior, but the new abstractions support laws that cover whole classes of cases.

### Type order

$$
A \preceq A
$$

$$
A \preceq B \land B \preceq C \Rightarrow A \preceq C
$$

and acyclicity implies antisymmetry over declared identifiers.

### Normalization

$$
normalize(normalize(b)) = normalize(b).
$$

### Hold/resume

For a bindable effective term $b$ and stable link identity:

$$
resume(pin(b)) = b.
$$

While held:

$$
\llbracket Held(r,b) \rrbracket_W = r
$$

for all changes to the upstream world observed by $b$.

### Constants

$$
\llbracket Constant(r) \rrbracket_W = r.
$$

### Explicit composition

Where both sides are defined and all selectors match:

$$
\llbracket \rho_2 \circ \rho_1 \rrbracket(r)
 = \llbracket \rho_2 \rrbracket(\llbracket \rho_1 \rrbracket(r)).
$$

The implementation includes a test comparing an explicit composition with manual sequential application.

### No inferred path

The presence of composable direct edges does not imply a public relation for their path. This is a negative law of the registry.

### Selector single evaluation

A relation match evaluates its contextual selector once before execution. This is checked with a counting predicate.

### Identity quotient

At the partition level:

$$
union(a,b)=union(b,a),
$$

$$
union(a,a)=a,
$$

and duplicate or reordered edges induce the same quotient.

### Effect refusal

For all persistent and runtime state projections $State$:

$$
plan(v,W) = Unavailable(d)
\Rightarrow State(apply(v,W))=State(W).
$$

## Added tests

Four new test files add fourteen directly declared cases, with additional parameterized executions:

- `relations/system.test.ts`: direct evaluation, composition, universal scopes, no inferred paths, single predicate evaluation, composition law, and registration/runtime failure cases;
- `kernel/kernel.test.ts`: one-declaration construction, shared predicates, explicit revisions, vocabulary/link projection, and translator compatibility;
- `links/expression.test.ts`: wire/IR round trips, normalization idempotence, dependency extraction, and checker behavior;
- `links/identity.quotient.test.ts`: quotient construction and order/duplicate invariance.

These run beside the pre-existing action, help, translator, type, link, identity, target-resolution, and purity suites.

## Verification performed

The following checks completed successfully in the provided environment:

| Check | Result |
|---|---|
| `git diff --check` before commit | Pass |
| Strict TypeScript check for core production sources | Pass |
| Strict TypeScript check for core test sources | Pass |
| Strict TypeScript check for `createPbui.tsx` with typed React/component stubs | Pass |
| TypeScript build of pure test sources | Pass |
| Dependency-free compatibility runner over pure suites | 188 passed, 0 failed |
| Static link-kernel browser/React dependency scan | No offenders |
| Repository commit | `985f34ac319877e07e3fe018e7a4bf4529c7e57e` |

The compatibility runner provides the Vitest primitives used by the pure suites and executes the compiled tests without installing the workspace. It is not claimed to be a complete substitute for the repository's official Vitest/Vite environment. Its purpose was to exercise runtime semantics when external package installation was unavailable.

## Verification not completed

The official `pnpm test` or package build could not start because `node_modules` was absent and Corepack attempted to download `pnpm@10.15.1`; DNS resolution for the npm registry failed in the isolated environment.

`go test ./...` could not reach compilation because the Go command attempted to download toolchain `go1.26.6`; DNS resolution for the Go proxy failed.

No browser-level Playwright, Storybook, visual-regression, or downstream product build was run. The React assembly was checked at the TypeScript boundary using typed stubs, not rendered in a browser.

These are environmental gaps, not passing checks. The first integration step in a connected development environment should be the repository's exact package-manager install, full test command, build, and downstream consumer smoke tests.

# Complexity and performance

## Type operations

Type reachability and distance use the existing `PresentationTypeGraph`. The relation system delegates to it rather than building a second graph. Registration performs finite validation over declarations and composition edges. The relevant sizes are product type counts, ordinarily small compared with application data.

## Relation registration

Let $r$ be the number of relation declarations and $k$ the total number of step references across explicit compositions. Preparation is a depth-first traversal with memoization. Excluding graph reachability costs, it is $O(r+k)$. Composition-cycle detection is performed during the same traversal.

Prepared relations are stored by identifier and in declaration order. Identifier lookup is expected $O(1)$. `applicable` and `matches` scan the finite ordered relation list, so they are $O(r)$ plus predicate and relation evaluation. This is appropriate for a declaration registry; if products eventually register thousands of relations, indexing by source ancestry and target type can be added without changing the API.

No implicit path search means acceptance cost does not depend exponentially on graph path combinations.

## Binding compilation and analysis

For a binding term of size $n$, `programOf`, `bindingOf`, normalization, dependency extraction, and static type inference are $O(n)`. Current persisted terms are usually shallow, but the linear formulation is important if explicit relation chains become common.

Cycle checking additionally explores the existing dependency graph from the proposed dependencies. For $|P|$ ports and $|E|$ dependency edges, a straightforward traversal is $O(|P|+|E|)$ in the affected region.

## Identity compilation

For $m$ admitted identity declarations over $n$ participating ports, disjoint-set operations take $O(m\alpha(n))$ amortized. Canonical component sorting and stable identifier assignment add comparison costs. The current overlap-based lineage assignment can approach $O(c^2 n)$ in contrived cases with $c$ previous/current classes because it computes set overlaps by array membership. PBUI workbenches are small, but this is the most obvious algorithmic improvement if identity classes become large: represent member sets once and build an inverted map from port to previous class.

## Snapshot revisions

Requiring a semantic revision avoids hidden $O(|F|)$ serialization at every snapshot and allows products to invalidate only when facts relevant to presentation semantics change. A monotonic store revision or composite of a few subsystem revisions is typically sufficient.

## Runtime relation duplication

The `matches` method evaluates applicability once and passes captured provenance into execution. Direct `evaluate` also performs one applicability check. Explicit compositions evaluate the composition selector and each step selector. This is intentional: a composition has its own visibility, while each component relation remains contextually partial.

# Failure, security, and operational semantics

## Fail-closed registration

The kernel rejects malformed static declarations before runtime:

- duplicate scopes or relation identifiers;
- unknown type, scope, or predicate references;
- nonfinite priorities;
- abstract relation targets where concrete targets are required;
- empty, cyclic, unknown, or disconnected compositions;
- simultaneously supplying canonical relations and legacy translators;
- descriptors for undeclared types.

Missing descriptors for concrete types are diagnostics rather than hard errors because the existing descriptor registry has a JSON-label fallback. This preserves behavior while making the incompleteness visible.

## Fail-closed execution

At runtime, a relation cannot silently return an unrelated type. A thrown callback becomes `relation-threw`; a bad result becomes `invalid-result-type`; failed applicability becomes an unavailable result with stage-specific code; a missing relation remains distinct from an empty partial-function result.

The link boundary additionally rejects non-serializable relation outputs.

## Authority boundaries

The kernel computes semantic eligibility. It is not the authorization boundary. `createPbui` routes serializable verbs and attribution envelopes to a product-supplied effect handler. Products and gateways must still enforce permissions against fresh server or store state.

Capabilities in a snapshot are decision inputs, not cryptographic proof. They may support honest UI suppression and agent vocabulary but must not replace effect-side authorization.

## User and agent observability

Explicit ambiguity and refusal are critical for both human and agent operation. A human can be offered a chooser rather than receiving an arbitrary conversion. An agent can inspect vocabulary and diagnostics and receive a fresh-state refusal rather than inferring success from a stale rendered affordance.

The implemented `onRefuse` hook is a first step. A fuller protocol should standardize decision envelopes across actions, acceptance, links, and target resolution, including a structured explanation/provenance tree.

## Determinism

The system removes registration order as an acceptance tie-break. Ambiguous candidates are lexically ordered only for stable presentation after ambiguity has already been declared.

Relation declarations retain order for vocabulary and scanning, but order does not alter type or selector truth. Identity partitions are invariant under edge order and duplicates. Class identifiers remain deterministic under the specified previous-state and lexical rules.

# Design decisions reconsidered

## Decisions retained from `PBUI-KERNEL-1`

The ticket's central decision to construct one kernel object from one declaration is retained. Its insistence that the four resolvers remain separate is also retained and strengthened through the “shared match stream, distinct fold” model.

One predicate map and a kernel-supplied link dependency view are implemented.

The runtime accepts the kernel, but the proposed hard cutover is softened to a compatibility union. This is an engineering deviation, not a semantic disagreement. It allows the core to land independently of every product migration.

## Revision decision changed

The ticket proposed deriving a revision by stable serialization unless overridden. The implementation rejects that default. Semantic invalidation identity is made explicit.

This is the most consequential deliberate departure from the ticket because revision behavior affects correctness, cost, and cache semantics. A convenience serializer can still be supplied by a product during prototyping, but it is not built into the kernel's meaning.

## Decisions retained from `PBUI-LINK-1`

The link kernel remains a sibling of actions, persistent declarations remain separate from live runtime values, references remain the transported value form, evaluation remains pull-based, and the pure core stays independent of React/workbench stores.

The `Derived` facility still reuses the presentation transformation registry, but that registry is generalized from translators to relations.

Identity remains a later, compiled layer over compatible ports; its quotient semantics are now public.

## Link grammar refined, not replaced

The ticket's binding terms remain the storage and public verb language. The report's source/computation/control decomposition is implemented as IR. This avoids a migration while providing the compiler architecture needed for future extension.

## Snapshot composition

The conceptual recommendation remains that a full link world contains presentation context rather than being ontologically a kind of selection. The existing `LinkSnapshot extends SelectionSnapshot` shape was not replaced in this core change because it would fan out through the complete link implementation and tests. `kernel.linkDeps({ snapshotFor })` introduces an explicit projection boundary now; a future version can migrate to composition without blocking the relation work.

# Limitations and deferred work

## The relation model is single-result

A relation is a contextual partial function, not a general relation returning many references. This is appropriate for current translators and derived bindings. Facets or search-like operations may need a finite collection result. Those should declare cardinality explicitly rather than overloading `undefined | reference`.

## Composition lacks optimizer laws and provenance trees

Explicit compositions execute their named steps and validate intermediate types. They do not yet expose a nested provenance tree showing which step was empty or failed, nor do they normalize associativity or share prefixes. Detailed composition diagnostics are a useful next step.

## Selector conditions are declarative but not statically analyzed

Predicate identifiers are validated, but the condition language is not analyzed for contradictions, redundancy, capability monotonicity, or dependence on revision components. An abstract interpretation of conditions could produce better dead-rule diagnostics [10].

## Alias remains in the wire grammar

The quotient API exposes the correct model, but `Alias(classId)` remains a source term for compatibility. A future document version could store cell ownership separately and keep per-port terms exclusively for directed value expressions. That migration should occur only with complete persistence and undo tests.

## Port semantic roles remain nominal strings

`semanticRole` is still a string. If roles acquire matching or inheritance semantics, they should become declared identifiers with their own explicit relation or order. Arbitrary strings must not silently evolve into another unvalidated type system.

## Decision-result algebra is not yet unified

Actions, relations, links, show targets, and availability use related but distinct unions. A small shared decision envelope could standardize available, unavailable, ambiguous, inapplicable, error, explanation, and provenance fields. Care is needed not to erase domain-specific states.

## Full integration validation remains outstanding

The official workspace, browser, server, and downstream consumer tests require an environment with dependencies and network or a prepopulated package store. The core passes the checks available here, but landing should remain contingent on full CI.

# Research agenda

## Universal provenance

Define a recursive provenance algebra used by actions, help, relations, link values, and target resolution. A derived value's provenance would compose source provenance with the relation step. A followed value would include source port, link identifier, and upstream provenance. Acceptance would explain ranking and ambiguity. This would support a general “why is this here?” inspector for humans and agents.

## A generic decision protocol

Introduce a parameterized result such as:

```ts
type Decision<Value, Option = never> =
  | { kind: "available"; value: Value; provenance?: Provenance }
  | { kind: "unavailable"; code: string; because: Explanation }
  | { kind: "ambiguous"; options: readonly Option[]; because?: Explanation }
  | { kind: "error"; code: string; because: Explanation; cause?: unknown };
```

Subsystems would refine, not blindly reuse, this core. The gain is a consistent agent and telemetry contract.

## First-class operation compatibility

Replace implicit uses of whole `PortContract` equality with named relations:

- `canFlow(source,destination)`;
- `canShareCell(a,b)`;
- `canAccept(reference,port)`;
- `canMergeUpdates(a,b)`.

Each operation can cite the value/protocol fields it requires. This makes future features such as read-only aliases or conversion-at-boundary links easier to specify.

## Expression growth with bounded power

The normalized IR creates a safe place for carefully chosen expression forms:

- tuple/product construction;
- projection;
- finite fan-in with an explicit update algebra;
- optional/default expressions;
- guarded relation application;
- provenance-preserving map.

Every constructor should define typing, dependencies, serialization, normalization, and evaluation before entering the wire grammar. The system should resist embedding a general-purpose scripting language in link documents.

## Incremental dependency maintenance

Current cycle checking may traverse the dependency graph per plan. For large workbenches, maintain a revision-indexed dependency summary or dynamic topological order. The normalized program makes such an optimization local to one interpreter.

## Condition analysis

Because conditions reference a finite predicate registry and explicit mode/capability atoms, registration can potentially detect unreachable contributions, shadowed rules, contradictory conjunctions, or relations whose context can never coexist with their composition steps. Abstract interpretation offers a principled approach [10].

## Mechanized laws

Property-based generators should produce random acyclic type graphs, relation registries, binding programs, and compatible identity declarations. Useful properties include:

- relation composition type preservation;
- normalization idempotence and wire round-trip stability;
- dependency extraction invariance under normalization;
- quotient invariance under edge permutation and duplication;
- no-effect refusal;
- preservation of prior class identifiers under unchanged components;
- acceptance independence from declaration order except stable ambiguity display.

A smaller executable specification in a proof assistant is possible but probably premature. High-quality property tests would yield most of the immediate benefit.

# Conclusion

The PBUI tickets already contain the ingredients of a rigorous interactive semantics: nominal types, contextual applicability, deterministic selection, explicit ambiguity, persistent link terms, pure planning, pull evaluation, fresh revalidation, and compiled identity classes. The implementation reported here does not discard those decisions. It exposes their common mathematical structure.

The central kernel is now organized around a finite type order, one contextual predicate/selector system, and a canonical registry of typed contextual partial functions. Actions, help, acceptance, and links remain sibling interpreters because their result algebras are genuinely different. Translators become a migration spelling of relations rather than the foundational concept.

The link system now has an explicit compiler boundary. Stable persisted terms compile into programs that separate atomic sources, relation application, and control/error state. Static checking, dependency extraction, normalization, evaluation, and cycle reasoning can operate on one representation. Identity is exposed as a quotient of compatible ports rather than being treated as directed following under another name.

The result is a smaller conceptual basis with stronger laws:

$$
\text{types} + \text{context} + \text{relations} + \text{programs}
+ \text{identity} + \text{interpreters}.
$$

That basis is expressive enough for current behavior, composable enough for explicit relation chains and future binding operators, and conservative enough to preserve serialized documents and legacy call sites. The implementation passes all pure tests and strict checks available in the isolated environment. Full workspace and browser integration remain required before production landing, but the core semantic consolidation is implemented and testable.

\appendix

# Public API sketch

## Relation definition helpers

The new subsystem exports direct and composed declaration helpers through `presentation/relations`:

```ts
const customerOfOrder = defineRelation({
  id: "order.customer",
  from: "order",
  to: "customer",
  match: "exact",
  scopes: ["workspace"],
  apply(order, snapshot) {
    return snapshot.product.customerOf(order.value);
  },
});

const accountOfOrder = defineRelationComposition({
  id: "order.account",
  steps: ["order.customer", "customer.account"],
});
```

Prepared compositions infer their endpoints from the first and last step. They retain their own scopes, condition, priority, label, and description.

## Kernel definition helper

`definePresentation` preserves generics and supplies the symbol-marked snapshot-input helper before construction:

```ts
const presentation = definePresentation({
  types,
  scopes,
  predicates,
  descriptors,
  actions,
  relations,
  help,
  revision: facts => facts.semanticRevision,
});

const kernel = presentation.create();

const input = presentation.snapshotInput(facts, {
  scopes: ["tile", "workspace"],
  modes: ["connect"],
  revision: facts.semanticRevision,
});
```

## Link dependencies

```ts
const deps = kernel.linkDeps({
  snapshotFor(linkWorld) {
    return kernel.snapshot(readProductFacts(linkWorld), {
      scopes: linkWorld.scopes,
      modes: linkWorld.modes,
      capabilities: linkWorld.capabilities,
      revision: linkWorld.revision,
    });
  },
  label(reference) {
    return kernel.descriptors.label(reference, environment);
  },
});
```

The link engine sees serializable relation definitions and a controlled evaluation callback, not the entire kernel.

## Program analysis

```ts
const program = programOf(binding);
const dependencies = dependenciesOfProgram(program);
const result = checkProgram(program, destinationPort, snapshot, deps);

if (result.kind === "valid") {
  console.log(result.resultType);
  console.log([...result.dependencies.ports]);
}
```

# Validation transcript

The final core verification run used Node 22.16.0, npm 10.9.2, and TypeScript 5.8.3.

```text
git diff --check... ok
core production TypeScript... ok
core tests TypeScript... ok
React facade TypeScript with typed stubs... ok
pure test build TypeScript... ok
pure runtime suite...
MINI_VITEST_RESULT total=188 passed=188 failed=0 duration_ms=349
LINK_PURITY_RESULT offenders=[]
```

The official command attempts failed before tests for environmental reasons:

```text
corepack pnpm test
  Corepack attempted to fetch pnpm-10.15.1.tgz
  DNS error: EAI_AGAIN registry.npmjs.org

go test ./...
  Go attempted to download go1.26.6
  DNS timeout resolving proxy.golang.org
```

# Change inventory

The committed change affects 31 files and contains 2,699 insertions and 226 deletions relative to baseline commit `7b89b76`. New production modules are:

```text
src/presentation/context/predicates.ts
src/presentation/kernel/create.ts
src/presentation/kernel/define.ts
src/presentation/kernel/index.ts
src/presentation/kernel/types.ts
src/presentation/links/check.ts
src/presentation/links/expression.ts
src/presentation/relations/adapters.ts
src/presentation/relations/define.ts
src/presentation/relations/index.ts
src/presentation/relations/system.ts
src/presentation/relations/types.ts
```

New tests are:

```text
src/presentation/kernel/kernel.test.ts
src/presentation/links/expression.test.ts
src/presentation/links/identity.quotient.test.ts
src/presentation/relations/system.test.ts
```

# Ticket-to-implementation matrix

| Ticket proposition | Implementation status | Notes |
|---|---|---|
| One kernel from one declaration | Implemented | `PresentationKernelDeclaration`, `createPresentationKernel` |
| Resolvers remain siblings | Implemented | Shared assets; distinct action/help/accept/link semantics |
| One predicate map | Implemented | Shared `PredicateRegistry` |
| Shared context matching | Strengthened | First-class `PresentationSelector` and provenance |
| Runtime takes kernel | Implemented with compatibility path | No forced immediate hard cutover |
| Snapshot helper | Implemented | Explicit semantic revision; symbol-marked `SnapshotInput` |
| Stable-serialization revision default | Rejected | Product/caller must supply semantic revision |
| Kernel-derived link dependencies | Implemented | Relation definitions and controlled world projection |
| Derived reuses translators | Generalized | Canonical relation system; translator adapter retained |
| Binding terms as persistent algebra | Preserved | Compiled into normalized IR |
| Pull evaluation | Preserved | Program interpreter remains pull-based |
| Pure planning and fresh apply | Preserved/strengthened | Candidate checker and refusal callback |
| Identity classes | Preserved/clarified | Explicit quotient API and optimized union-find |
| Persistent topology/live values split | Preserved | No store architecture rewrite |
| Hard cutover of products | Deferred | Compatibility reduces integration risk |

# Selected design cautions

1. Do not add automatic relation path search under the existing acceptance API. A path should be a named semantic declaration.
2. Do not treat a missing current relation value as a static type error. Contextual partiality is expected.
3. Do not use snapshot capabilities as effect-side authorization.
4. Do not introduce a new wire expression constructor without defining typing, dependencies, normalization, persistence, and evaluation together.
5. Do not make identity compatibility equal to ordinary value-flow compatibility by accident.
6. Do not remove compatibility branches until downstream products and persisted documents have explicit migration tests.
7. Do not derive revision identity by serializing arbitrary product state in the kernel.
8. Do not unify resolvers solely because they all begin by matching a selector.

# References {.unnumbered}

[1] Luca Cardelli and Peter Wegner. “On Understanding Types, Data Abstraction, and Polymorphism.” *ACM Computing Surveys* 17, no. 4 (1985): 471-523. DOI: 10.1145/6041.6042.

[2] Barbara Liskov and Jeannette M. Wing. “A Behavioral Notion of Subtyping.” *ACM Transactions on Programming Languages and Systems* 16, no. 6 (1994): 1811-1841. DOI: 10.1145/197320.197383.

[3] John C. Reynolds. “Definitional Interpreters for Higher-Order Programming Languages.” In *Proceedings of the ACM Annual Conference*, 1972. DOI: 10.1145/800194.805852.

[4] David L. Parnas. “On the Criteria To Be Used in Decomposing Systems into Modules.” *Communications of the ACM* 15, no. 12 (1972): 1053-1058. DOI: 10.1145/361598.361623.

[5] Butler W. Lampson. “Hints for Computer System Design.” In *Proceedings of the Ninth ACM Symposium on Operating Systems Principles*, 1983. DOI: 10.1145/800217.806614.

[6] Conal Elliott and Paul Hudak. “Functional Reactive Animation.” In *Proceedings of the Second ACM SIGPLAN International Conference on Functional Programming*, 1997: 263-273. DOI: 10.1145/258948.258973.

[7] Gilles Kahn. “The Semantics of a Simple Language for Parallel Programming.” In *Information Processing 74: Proceedings of IFIP Congress 74*, 1974: 471-475.

[8] Robert Endre Tarjan. “Efficiency of a Good But Not Linear Set Union Algorithm.” *Journal of the ACM* 22, no. 2 (1975): 215-225. DOI: 10.1145/321879.321884.

[9] H. T. Kung and John T. Robinson. “On Optimistic Methods for Concurrency Control.” *ACM Transactions on Database Systems* 6, no. 2 (1981): 213-226. DOI: 10.1145/319566.319567.

[10] Patrick Cousot and Radhia Cousot. “Abstract Interpretation: A Unified Lattice Model for Static Analysis of Programs by Construction or Approximation of Fixpoints.” In *Proceedings of the Fourth ACM Symposium on Principles of Programming Languages*, 1977: 238-252. DOI: 10.1145/512950.512973.
