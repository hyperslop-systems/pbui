export interface DeviceAuthorization {
  id: string;
  requested_name: string;
  requested_scopes: string[];
  expires_at: string;
  token_lifetime_seconds: number;
  state: "pending" | "approved" | "denied" | "consumed" | "expired";
}

export interface DeviceProblem {
  code: string;
  detail: string;
}

export class DeviceAPIError extends Error {
  constructor(
    public readonly problem: DeviceProblem,
    public readonly status: number,
  ) {
    super(problem.detail);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const problem = (await response.json().catch(() => null)) as DeviceProblem | null;
    throw new DeviceAPIError(
      problem ?? { code: "RequestFailed", detail: `Request failed (${response.status})` },
      response.status,
    );
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/**
 * Device approval intentionally does not use the general RTK Query transport.
 * That transport may attach a user-owned bearer token from sessionStorage;
 * pairing must prove the browser's HttpOnly session, not a token that happened
 * to be open in this tab. These requests remain same-origin cookie requests.
 */
export function getDeviceAuthorization(id: string, userCode: string): Promise<DeviceAuthorization> {
  return request<DeviceAuthorization>(
    `/v1/device/authorizations/${encodeURIComponent(id)}?user_code=${encodeURIComponent(userCode)}`,
  );
}

export function approveDeviceAuthorization(id: string, userCode: string): Promise<void> {
  return request<void>(`/v1/device/authorizations/${encodeURIComponent(id)}/approve`, {
    method: "POST",
    body: JSON.stringify({ user_code: userCode }),
  });
}

export function denyDeviceAuthorization(id: string, userCode: string): Promise<void> {
  return request<void>(`/v1/device/authorizations/${encodeURIComponent(id)}/deny`, {
    method: "POST",
    body: JSON.stringify({ user_code: userCode }),
  });
}
