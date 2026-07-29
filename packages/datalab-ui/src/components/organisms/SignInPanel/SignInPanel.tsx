import {
  AppBody,
  Callout,
  LinkAction,
  SectionLabel,
  Stack,
  Text,
  Toolbar,
} from "@hyperslop-systems/pbui";

/**
 * The browser sign-in surface for Datadrop's sole authentication mode.
 *
 * The browser never receives a provider bearer token. It navigates to the
 * provider through Datadrop's BFF endpoint, then returns with an opaque local
 * session cookie. Non-browser callers use separately minted ddp_ tokens.
 *
 * ## Registration moved out (DATADROP-14)
 *
 * This used to carry a second `<LinkAction>` reading "Create an account →".
 * Sign-in and sign-up answer different questions — *which provider, and what
 * went wrong last time* against *what is this, what will it cost me, what
 * happens next* — and the second was being answered by a five-word link label.
 * `SignUpPanel` answers it properly; what is left here is a pointer, so a
 * visitor on this tile still learns the other one exists.
 */
const SIGN_IN_ERRORS: Record<string, string> = {
  provider_refused: "The identity provider refused, or you cancelled.",
  state_mismatch: "This sign-in did not start in this browser. Start again from this page.",
  state_expired: "That sign-in took too long, or was already used. Start again.",
  exchange_failed: "The identity provider's answer could not be verified.",
  email_unverified: "Your email address is not verified yet. Check your inbox, then sign in again.",
  account_disabled: "This account is disabled here. Ask an administrator.",
};

export function SignInPanel({
  signupEnabled = false,
  issuer,
  errorCode,
  returnPath,
}: {
  signupEnabled?: boolean;
  issuer?: string | null;
  /** The `auth_error` code from the callback, not a message. */
  errorCode?: string | null;
  returnPath: string;
}) {
  return (
    <AppBody>
      <Stack gap={4}>
        {errorCode && (
          <Callout variant="warning" title="Sign-in did not complete">
            <Text size="small" tone="faint">
              {SIGN_IN_ERRORS[errorCode] ?? "Something went wrong on the way back. Try again."}
            </Text>
          </Callout>
        )}

        <Stack gap={3}>
          <Stack gap={2}>
            <SectionLabel>Sign in</SectionLabel>
            <Text size="small" prose>
              datadrop does not hold your password. Signing in hands you to the identity provider,
              which sends you back here once it is satisfied.
            </Text>
          </Stack>

          <Toolbar>
            {/* Links, not fetch(). An OIDC authorization request is a top-level navigation. */}
            <LinkAction
              href={`/v1/auth/login?return=${encodeURIComponent(returnPath)}`}
              data-testid="sign-in"
            >
              Sign in →
            </LinkAction>
          </Toolbar>
          {signupEnabled && (
            <Text size="tiny" tone="faint">
              No account yet? The <strong>sign up</strong> tile explains what one gets you.
            </Text>
          )}

          {issuer && (
            <Text size="tiny" tone="faint">
              identity provider: {issuer}
            </Text>
          )}
        </Stack>
      </Stack>
    </AppBody>
  );
}
