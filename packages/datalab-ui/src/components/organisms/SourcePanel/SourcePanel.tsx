import { SourceChip } from "../../atoms";
import {
  AppBody,
  EmptyState,
  SectionLabel,
  SelectInput,
  Stack,
  TextInput,
  Toolbar,
} from "@hyperslop-systems/pbui";
import { ErrorNotice } from "../../molecules";
import type { SourceRef } from "../../../model/table";

export interface DropOption {
  name: string;
  public_read: boolean;
}

/**
 * The source browser: drops, then their streams and dataset files.
 *
 * Every stream and every file is a `<source>` presentation, so loading one is a
 * left-click. The chips wrap themselves — that is what `SourceChip` is — so
 * this panel passes refs rather than rendering names.
 */
export function SourcePanel({
  token,
  showToken = true,
  drops,
  chosenDrop,
  streams,
  datasets,
  chosenDataset,
  files,
  latestVersion,
  error,
  onTokenChange,
  onDropChange,
  onDatasetChange,
}: {
  token: string;
  /**
   * Offer an optional user-owned ddp_ bearer-token field. Normal browser
   * operation uses the OIDC-backed session cookie instead.
   */
  showToken?: boolean;
  drops: readonly DropOption[];
  chosenDrop: string;
  streams: readonly string[];
  datasets: readonly string[];
  chosenDataset: string;
  files: readonly string[];
  /** Null when the dataset has no committed version yet. */
  latestVersion: number | null;
  /** Set when listing drops failed — almost always a missing credential. */
  error?: boolean;
  onTokenChange(next: string): void;
  onDropChange(next: string): void;
  onDatasetChange(next: string): void;
}) {
  const source = (over: Partial<SourceRef>): SourceRef =>
    ({ kind: "stream", drop: chosenDrop, ...over }) as SourceRef;

  return (
    <>
      {showToken && (
        <Toolbar tight bordered>
          <SectionLabel>Token</SectionLabel>
          <TextInput
            type="password"
            accessibleName="bearer token"
            placeholder="bearer token (public-read drops need none)"
            value={token}
            width="fill"
            size="tiny"
            onValueChange={onTokenChange}
          />
        </Toolbar>
      )}

      <AppBody>
        <Stack gap={4}>
          {error && (
            <ErrorNotice message="Could not list drops. If this server requires a token, enter one above." />
          )}

          <Stack gap={2}>
            <SectionLabel>Drop</SectionLabel>
            {drops.length === 0 && !error ? (
              <EmptyState
                message="no drops here yet"
                hint="Create one with `datadrop create`, or sign in if this server has private drops."
              />
            ) : (
              <SelectInput
                accessibleName="drop"
                variant="framed"
                value={chosenDrop}
                onValueChange={onDropChange}
                options={drops.map((d) => ({
                  value: d.name,
                  label: d.public_read ? `${d.name} (public)` : d.name,
                }))}
              />
            )}
          </Stack>

          <Stack gap={2}>
            <SectionLabel>Streams</SectionLabel>
            <Stack direction="row" gap={2} wrap>
              {streams.map((stream) => (
                <SourceChip key={stream} source={source({ kind: "stream", stream })} />
              ))}
              {streams.length === 0 && <EmptyState message="no streams in this drop" />}
            </Stack>
          </Stack>

          <Stack gap={2}>
            <SectionLabel>Datasets</SectionLabel>
            {datasets.length === 0 ? (
              <EmptyState message="no datasets in this drop" />
            ) : (
              <SelectInput
                accessibleName="dataset"
                variant="framed"
                value={chosenDataset}
                onValueChange={onDatasetChange}
                options={datasets.map((d) => ({ value: d, label: d }))}
              />
            )}
            <Stack direction="row" gap={2} wrap>
              {files.map((path) => (
                <SourceChip
                  key={path}
                  source={source({
                    kind: "dataset",
                    dataset: chosenDataset,
                    version: latestVersion ?? 1,
                    path,
                  })}
                />
              ))}
              {latestVersion !== null && files.length === 0 && (
                <EmptyState message={`no files in version ${latestVersion}`} />
              )}
            </Stack>
          </Stack>
        </Stack>
      </AppBody>
    </>
  );
}
