import { Lockup, PHASE_BLURB, PhaseIcon, PHASES, phaseVar } from "../../brand";
import {
  AppBody,
  Button,
  Callout,
  LinkAction,
  SectionLabel,
  Stack,
  Text,
  Toolbar,
} from "@hyperslop-systems/pbui";
import styles from "./SignUpPanel.module.css";

/**
 * The way in, for someone who has not been here before — the presentational
 * half.
 *
 * ## Why this is a separate application from `signin`
 *
 * They answer different questions. Sign-in asks *which provider, and what went
 * wrong last time*; sign-up asks *what is this, what will it cost me, and what
 * happens next*. Both used to be two links in one panel, which meant the second
 * question was answered by a five-word link label.
 *
 * ## What it is NOT
 *
 * It is not a registration form and must not become one. The identity provider
 * owns passwords, MFA, email verification and the registration form itself
 * (DATADROP-5), and datadrop never stores a password. This tile's whole job is
 * to explain the offer, set expectations about the hand-off, and own the state
 * the visitor comes back to.
 *
 * The hand-off is one query parameter — `intent=signup`, which the server turns
 * into OIDC's `prompt=create` — and that really is the entire server-side
 * difference between signing in and signing up.
 *
 * ## The four phases are load-bearing here
 *
 * This is the one surface in the *product* where the brand's vocabulary has to
 * mean something concrete rather than decorate a heading, so the benefits are
 * listed as IMPORT / UNDERSTAND / VISUALIZE / EXPORT with their own icons. A
 * visitor learns the four words here and meets them again as chip tones in the
 * workbench, because the colours are the same values (DR-98).
 *
 * Note the labels take their phase colour only as the ICON's colour: the tones
 * are graphic colours held to 3:1 and would fail as small text on paper.
 */
export interface SignUpPanelProps {
  /** False when the deployment does not accept new accounts. */
  signupEnabled?: boolean;
  /** The identity provider, so the hand-off names where it is sending you. */
  issuer?: string | null;
  /** Where to come back to. Same-origin path only; the server re-validates. */
  returnPath: string;
  /**
   * True when this browser has just completed a first sign-in.
   *
   * Read from the store rather than from `?first=1` directly (DR-96): the query
   * parameter has exactly one consumer, because two components racing to read
   * and rewrite one parameter means exactly one wins and the other has already
   * acted on a value it then erases.
   */
  justSignedUp?: boolean;
  /** The new account's display name, when there is one to greet. */
  name?: string | null;
  /** Switch to the account stage — upload, tokens, profile. */
  onOpenAccount?: () => void;
}

export function SignUpPanel({
  signupEnabled = false,
  issuer,
  returnPath,
  justSignedUp = false,
  name,
  onOpenAccount,
}: SignUpPanelProps) {
  // State 3: back from the provider, with an account that did not exist before.
  if (justSignedUp) {
    return (
      <AppBody>
        <Stack gap={4}>
          <Lockup size="footer" />
          <Stack gap={2}>
            <SectionLabel>{name ? `Welcome, ${name}` : "Your account is ready"}</SectionLabel>
            <Text size="small" prose>
              Everything you make from here is yours and persists. The account stage is where
              uploads, API tokens and your sessions live.
            </Text>
          </Stack>
          <Toolbar>
            {onOpenAccount && (
              // The design system's Button, not a hand-written one:
              // `test/no-raw-controls.test.ts` fails on a bare <button> outside
              // the atoms that own them, and it is right to — a raw control
              // here would miss the focus ring, the busy state and the tone
              // vocabulary every other control in the product has.
              <Button variant="raised" fill="var(--brand-import)" onClick={onOpenAccount}>
                Open the account stage →
              </Button>
            )}
          </Toolbar>
        </Stack>
      </AppBody>
    );
  }

  // State 4: a closed deployment. Said plainly, because the alternative is a
  // button that fails at the provider with a page that never mentions datadrop.
  if (!signupEnabled) {
    return (
      <AppBody>
        <Stack gap={4}>
          <Lockup size="footer" />
          <Callout variant="warning" title="This deployment is closed">
            <Text size="small" tone="faint">
              New accounts are not being accepted here. Ask an administrator for an invitation, or
              sign in if you already have one.
            </Text>
          </Callout>
          <Toolbar>
            <LinkAction href={`/v1/auth/login?return=${encodeURIComponent(returnPath)}`}>
              Sign in →
            </LinkAction>
          </Toolbar>
        </Stack>
      </AppBody>
    );
  }

  // State 1: the invitation.
  return (
    <AppBody>
      <Stack gap={4}>
        <Lockup size="footer" />

        <Stack gap={2}>
          <SectionLabel>Create an account</SectionLabel>
          <Text size="small" prose>
            You are looking at a shared demo dataset. An account gives you your own.
          </Text>
        </Stack>

        <ul className={styles.benefits}>
          {PHASES.map((phase) => (
            <li key={phase} className={styles.benefit}>
              <span className={styles.icon} style={{ color: phaseVar(phase) }}>
                <PhaseIcon phase={phase} size={14} />
              </span>
              <span className={styles.phase}>{phase}</span>
              <Text size="small">{PHASE_BLURB[phase]}</Text>
            </li>
          ))}
        </ul>

        <Stack gap={2}>
          <Toolbar>
            {/*
              Links, not fetch(). An OIDC authorization request is a top-level
              navigation, and trying to do it with fetch() is a standard
              afternoon lost to CORS.
            */}
            <LinkAction
              href={`/v1/auth/login?intent=signup&return=${encodeURIComponent(returnPath)}`}
              data-testid="sign-up"
            >
              Create an account →
            </LinkAction>
            <LinkAction
              href={`/v1/auth/login?return=${encodeURIComponent(returnPath)}`}
              data-testid="sign-in-from-signup"
            >
              I already have one →
            </LinkAction>
          </Toolbar>

          <Text size="tiny" tone="faint" prose>
            datadrop never sees your password. Registration happens at{" "}
            {issuer ? <strong>{issuer}</strong> : "the identity provider"}, which sends you back
            here once it is satisfied.
          </Text>
        </Stack>
      </Stack>
    </AppBody>
  );
}
