import { useEffect, useState } from "react";
import { useMeQuery } from "../../api/client";
import { registerApp, type AppProps } from "../../appkit/registry";
import { SignInPanel } from "../../components/organisms";

/**
 * The way in — the container half.
 *
 * Everything visible is `SignInPanel`; this holds the query and callback-error
 * plumbing. The split keeps the OIDC redirect boundary explicit and makes the
 * callback error states independently reviewable.
 */
function SignInApp(_props: AppProps) {
  const { data: me } = useMeQuery();
  const [error, setError] = useState<string | null>(null);

  // The callback lands at /ui/?auth_error=… . Read it once and strip it, so a
  // reload or a bookmark does not replay a failure that is over.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("auth_error");
    if (!code) return;
    setError(code);
    params.delete("auth_error");
    const query = params.toString();
    window.history.replaceState({}, "", window.location.pathname + (query ? `?${query}` : ""));
  }, []);

  return (
    <SignInPanel
      signupEnabled={me?.signup_enabled ?? false}
      issuer={me?.provider?.issuer ?? null}
      errorCode={error}
      returnPath={returnPath()}
    />
  );
}

/** Where to come back to. Same-origin path only; the server re-validates. */
function returnPath(): string {
  return window.location.pathname + window.location.search;
}

registerApp({
  id: "signin",
  title: "sign in",
  tone: "var(--pbui-tone-doc)",
  docBound: false,
  duplicable: false,
  singleton: true,
  Component: SignInApp,
});
