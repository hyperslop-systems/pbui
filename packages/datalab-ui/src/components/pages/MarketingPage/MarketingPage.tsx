import { useEffect, useRef, useState } from "react";
import "../../../apps/all";
import { ClaimBlock, Lockup, PhaseRule } from "../../brand";
import { Text } from "@hyperslop-systems/pbui";
import { TOUR_FIXTURES, heroSeed } from "../../../tour";
import { TutorialBand } from "../TutorialBand";
import { WorkbenchInstance } from "../WorkbenchInstance";
import {
  DESIGN_NOTE,
  FEATURES,
  FOOTER,
  HERO,
  NAV,
  OPEN_WORKBENCH,
  RUNTIME,
  TUTORIAL,
  WHY,
  WORKFLOW,
} from "./copy";
import styles from "./MarketingPage.module.css";

/**
 * The front door: what a stranger sees at `/`.
 *
 * ## One page, containing the tour (DR-91)
 *
 * The tutorial is a *band* of this page rather than a second page sharing
 * components. Two pages would mean two mastheads, two navigations, two places
 * to change a headline, and a real chance that someone who landed on the tour
 * never saw the marketing page. `/ui/tour` still works and lands here, scrolled
 * to `#tutorial` — one page, two entrances.
 *
 * ## The hero is the live product, not a picture of it
 *
 * `WorkbenchInstance` with the tour's committed fixtures, so it renders with
 * the API absent, returning 500, or demanding an account — which is what a
 * landing page's visitor always faces (DR-48). It is the same `WorkbenchShell`
 * the product renders, which is the only reason it is honest to put it above a
 * paragraph claiming the product works this way.
 *
 * Six stores end up on this page: this hero plus the tutorial band's five. They
 * share a module graph, a registry, a stylesheet and nothing else (DR-45).
 *
 * ## The copy lives in `copy.ts`
 *
 * All of it, so the page can be read as prose by someone who does not write
 * React. It is the reference landing page's copy with "PBUI" replaced by
 * "DATA LAB" and nothing else reworded — see that file's header for why that
 * reading was chosen.
 */
export function MarketingPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const [past, setPast] = useState(false);

  // The header condenses once the hero has scrolled away. An
  // IntersectionObserver rather than a scroll handler: one callback at the
  // boundary instead of one per frame for the length of a very long page.
  useEffect(() => {
    const element = heroRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setPast(!entry?.isIntersecting), {
      threshold: 0,
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // `/ui/tour` is this page, scrolled to the tutorial. Done here rather than
  // with a server redirect so the two entrances share one document and one
  // scroll position, and after a frame so the band has been laid out.
  useEffect(() => {
    if (!window.location.pathname.startsWith("/ui/tour")) return;
    const id = requestAnimationFrame(() => {
      document.getElementById("tutorial")?.scrollIntoView({ block: "start" });
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const go = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className={styles.page}>
      <header className={past ? `${styles.header} ${styles.headerOn}` : styles.header}>
        <div className={styles.headerInner}>
          <button type="button" className={styles.brand} onClick={() => go("product")}>
            <Lockup size="masthead" />
          </button>
          <nav className={styles.nav} aria-label="Primary">
            {NAV.map((item) => (
              <button
                key={item.id}
                type="button"
                className={styles.navItem}
                onClick={() => go(item.id)}
              >
                {item.label}
              </button>
            ))}
            <a className={styles.cta} href="/ui/">
              {OPEN_WORKBENCH}
            </a>
          </nav>
        </div>
      </header>

      <main>
        {/* ---------------------------------------------------- the hero -- */}
        <section id="product" className={styles.hero}>
          <div className={styles.wide}>
            <div className={styles.heroGrid}>
              <div>
                <div className={styles.eyebrow}>{HERO.eyebrow}</div>
                <h1 className={styles.headline}>{HERO.headline}</h1>
                <p className={styles.lede}>{HERO.lede}</p>
                <PhaseRule labels className={styles.heroRule} />
                <div className={styles.actions}>
                  <button type="button" className={styles.primary} onClick={() => go("tutorial")}>
                    {HERO.primary}
                  </button>
                  <button type="button" className={styles.quiet} onClick={() => go("runtime")}>
                    {HERO.secondary}
                  </button>
                </div>
                <div className={styles.chips}>
                  {HERO.chips.map((chip) => (
                    <span key={chip}>{chip}</span>
                  ))}
                </div>
              </div>

              <div ref={heroRef}>
                <div className={styles.tryIt}>
                  <strong>Try it:</strong> {HERO.tryIt.replace(/^Try it: /, "")}
                </div>
                {/*
                  The real workbench, answering from committed fixtures. NOT
                  persisted and NOT given a masthead: the page has its own, and
                  an embedded instance that writes to localStorage fights the
                  reader's actual layout for one key (DR-47).
                */}
                <div className={styles.heroPanel}>
                  <WorkbenchInstance
                    config={{
                      fixtures: TOUR_FIXTURES,
                      preloaded: heroSeed(),
                      apps: ["chart", "table", "pipeline", "encode", "sources", "launcher"],
                      workspaces: false,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------ why / cards -- */}
        <section className={styles.band}>
          <div className={styles.wide}>
            <div className={styles.sectionHead}>
              <div className={styles.eyebrow}>{WHY.eyebrow}</div>
              <h2 className={styles.h2}>{WHY.headline}</h2>
              <p className={styles.prose}>{WHY.lede}</p>
            </div>
            <div className={styles.cards}>
              {FEATURES.map((feature) => (
                <article key={feature.n} className={styles.card}>
                  <div className={styles.cardNumber}>{feature.n}</div>
                  <h3 className={styles.h3}>{feature.title}</h3>
                  <p className={styles.cardBody}>{feature.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* --------------------------------------------- the tutorial -- */}
        <section id="tutorial" className={styles.tutorial}>
          <div className={styles.wide}>
            <div className={styles.sectionHead}>
              <div className={styles.eyebrow}>{TUTORIAL.eyebrow}</div>
              <h2 className={styles.h2}>{TUTORIAL.headline}</h2>
              <p className={styles.prose}>{TUTORIAL.lede}</p>
              <div className={styles.narrowNote}>
                <Text size="small">{TUTORIAL.narrow}</Text>
              </div>
            </div>
          </div>
          <TutorialBand />
        </section>

        {/* ----------------------------------------------- the runtime -- */}
        <section id="runtime" className={styles.band}>
          <div className={styles.wide}>
            <div className={styles.runtimeGrid}>
              <div className={styles.sectionHead}>
                <div className={styles.eyebrow}>{RUNTIME.eyebrow}</div>
                <h2 className={styles.h2}>{RUNTIME.headline}</h2>
                <p className={styles.prose}>{RUNTIME.lede}</p>
              </div>
              <div className={styles.runtimeCards}>
                {RUNTIME.cards.map((card) => (
                  <div key={card.title} className={styles.runtimeCard}>
                    <h3 className={styles.h3}>{card.title}</h3>
                    <p className={styles.cardBody}>{card.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* --------------------------------------- the inverted claim -- */}
        <section className={styles.inverted}>
          <div className={styles.wide}>
            <div className={styles.claimGrid}>
              <div>
                <div className={styles.eyebrowInverted}>{WORKFLOW.eyebrow}</div>
                <h2 className={styles.h2}>{WORKFLOW.headline}</h2>
                <p className={styles.claimBody}>{WORKFLOW.body}</p>
              </div>
              <ClaimBlock />
            </div>
          </div>
        </section>

        {/* ------------------------------------------- the design note -- */}
        <section className={styles.band}>
          <div className={styles.wide}>
            <div className={styles.noteGrid}>
              <div>
                <div className={styles.eyebrow}>{DESIGN_NOTE.eyebrow}</div>
                <h2 className={styles.h2}>{DESIGN_NOTE.headline}</h2>
              </div>
              <p className={styles.prose}>{DESIGN_NOTE.body}</p>
            </div>

            <footer className={styles.footer}>
              <Lockup size="footer" />
              <span className={styles.footerTagline}>{FOOTER.tagline}</span>
              <span className={styles.spacer} />
              <a className={styles.cta} href="/ui/">
                {OPEN_WORKBENCH}
              </a>
              <button type="button" className={styles.footerLink} onClick={() => go("product")}>
                {FOOTER.back}
              </button>
            </footer>
          </div>
        </section>
      </main>
    </div>
  );
}
