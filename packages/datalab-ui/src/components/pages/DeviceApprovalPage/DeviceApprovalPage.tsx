import { useEffect, useMemo, useState } from "react";
import {
  approveDeviceAuthorization,
  denyDeviceAuthorization,
  getDeviceAuthorization,
  DeviceAPIError,
  type DeviceAuthorization,
} from "../../../api/device";
import {
  AppBody,
  Button,
  Callout,
  CodeText,
  LinkAction,
  SectionLabel,
  Stack,
  Text,
  Toolbar,
} from "@hyperslop-systems/pbui";
import { ErrorNotice } from "../../molecules";

export function DeviceApprovalPage() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const id = params.get("authorization_id") ?? "";
  const userCode = params.get("user_code") ?? "";
  const [record, setRecord] = useState<DeviceAuthorization | null>(null);
  const [error, setError] = useState<DeviceAPIError | Error | null>(null);
  const [working, setWorking] = useState<"approve" | "deny" | null>(null);
  const [complete, setComplete] = useState<"approved" | "denied" | null>(null);

  useEffect(() => {
    if (!id || !userCode) return;
    void getDeviceAuthorization(id, userCode)
      .then(setRecord)
      .catch((reason: unknown) => {
        setError(
          reason instanceof Error ? reason : new Error("Could not load this device request."),
        );
      });
  }, [id, userCode]);

  async function decide(action: "approve" | "deny") {
    setWorking(action);
    setError(null);
    try {
      if (action === "approve") await approveDeviceAuthorization(id, userCode);
      else await denyDeviceAuthorization(id, userCode);
      setComplete(action === "approve" ? "approved" : "denied");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason : new Error("Could not update this device request."),
      );
    } finally {
      setWorking(null);
    }
  }

  if (!id || !userCode) {
    return <InvalidLink />;
  }
  if (complete === "approved")
    return (
      <Complete
        title="Device approved"
        detail="Return to the terminal. It will receive its local Datadrop token shortly."
      />
    );
  if (complete === "denied")
    return <Complete title="Device denied" detail="The terminal will not receive a token." />;

  return (
    <AppBody>
      <Stack gap={4}>
        <Stack gap={2}>
          <SectionLabel>Approve device</SectionLabel>
          <Text size="small" prose>
            A coding agent is asking for a local Datadrop token. Verify the code shown in its
            terminal before approving.
          </Text>
        </Stack>
        <Callout variant="warning" title="Pairing code">
          <CodeText>{userCode}</CodeText>
        </Callout>
        {error && <ErrorNotice message={error.message} />}
        {error instanceof DeviceAPIError && error.status === 401 && (
          <Toolbar>
            <LinkAction
              href={`/v1/auth/login?return=${encodeURIComponent(window.location.pathname + window.location.search)}`}
            >
              Sign in to approve
            </LinkAction>
          </Toolbar>
        )}
        {!record && !error && (
          <Text size="small" tone="faint">
            Loading device request…
          </Text>
        )}
        {record && (
          <Stack gap={2}>
            <Text size="small">
              <strong>{record.requested_name}</strong> requests:
            </Text>
            <CodeText wrapAnywhere>{record.requested_scopes.join(", ")}</CodeText>
            <Text size="tiny" tone="faint">
              Pairing expires {new Date(record.expires_at).toLocaleString()}. The token will be
              valid for {formatLifetime(record.token_lifetime_seconds)} after the terminal retrieves
              it. Datadrop stores only its hash and the agent sees it once.
            </Text>
            <Toolbar>
              <Button
                busy={working === "approve" ? "approving…" : undefined}
                disabled={working !== null}
                onClick={() => void decide("approve")}
              >
                Approve device
              </Button>
              <Button
                busy={working === "deny" ? "denying…" : undefined}
                disabled={working !== null}
                onClick={() => void decide("deny")}
              >
                Deny
              </Button>
            </Toolbar>
          </Stack>
        )}
      </Stack>
    </AppBody>
  );
}

function formatLifetime(seconds: number): string {
  if (seconds % 86400 === 0) return `${seconds / 86400} day${seconds === 86400 ? "" : "s"}`;
  if (seconds % 3600 === 0) return `${seconds / 3600} hour${seconds === 3600 ? "" : "s"}`;
  if (seconds % 60 === 0) return `${seconds / 60} minute${seconds === 60 ? "" : "s"}`;
  return `${seconds} second${seconds === 1 ? "" : "s"}`;
}

function InvalidLink() {
  return (
    <AppBody>
      <Callout variant="warning" title="Invalid device approval link">
        <Stack gap={2}>
          <Text size="small" prose>
            This link is missing its pairing request or code. Return to the terminal and start
            pairing again.
          </Text>
          <Toolbar>
            <LinkAction href="/ui/">Open Datadrop</LinkAction>
          </Toolbar>
        </Stack>
      </Callout>
    </AppBody>
  );
}

function Complete({ title, detail }: { title: string; detail: string }) {
  return (
    <AppBody>
      <Callout variant="ok" title={title}>
        <Text size="small" prose>
          {detail}
        </Text>
      </Callout>
    </AppBody>
  );
}
