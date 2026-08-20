import { z } from "zod";

/* ---- references --------------------------------------------------------- */

export const ProvenanceSchema = z.object({
  messageId: z.string().optional(),
  toolCallId: z.string().optional(),
  widgetId: z.string().optional(),
});

/**
 * The wire reference. `id` is a string on the wire; Go's validator also
 * tolerates a number (the model sometimes writes `"id": 2049`), and so does
 * this one — `validateReference` mirrors that exactly, this schema is the
 * strict shape products declare verbs against.
 */
export const ReferenceSchema = z.object({
  type: z.string().regex(/^[A-Za-z_][A-Za-z0-9_.-]*$/),
  id: z.string().min(1),
  value: z.record(z.string(), z.unknown()).optional(),
  provenance: ProvenanceSchema.optional(),
});

export type ReferenceInput = z.infer<typeof ReferenceSchema>;

/* ---- the vocabulary file ------------------------------------------------- */

export const VERB_FIELD_TYPES = ["string", "number", "boolean", "ref", "refs", "object"] as const;
export type VerbFieldType = (typeof VERB_FIELD_TYPES)[number];

export const VerbSpecSchema = z.object({
  doc: z.string(),
  fields: z.record(z.string(), z.enum(VERB_FIELD_TYPES)),
  danger: z.boolean().optional(),
});
export type VerbSpec = z.infer<typeof VerbSpecSchema>;

export const TypeSpecSchema = z.object({
  doc: z.string(),
  idHint: z.string().optional(),
  tone: z.string().optional(),
  verbs: z.array(z.string()).optional(),
  example: z.string().optional(),
});
export type TypeSpec = z.infer<typeof TypeSpecSchema>;

export const WIDGET_KINDS = [
  "text",
  "refs",
  "meter",
  "sparkline",
  "segmented",
  "stat",
  "callout",
  "table",
  "diff",
  "log",
  "form",
  "widget",
] as const;
export type WidgetKind = (typeof WIDGET_KINDS)[number];

export const WIDGET_LAYOUTS = ["stack", "row", "grid"] as const;
export type WidgetLayout = (typeof WIDGET_LAYOUTS)[number];

export const WidgetVocabularySchema = z.object({
  schema_version: z.literal(1),
  kinds: z.array(z.enum(WIDGET_KINDS)),
  layouts: z.array(z.enum(WIDGET_LAYOUTS)).optional(),
});

export const ConversionSchema = z.object({ from: z.string(), to: z.string() });
export type Conversion = z.infer<typeof ConversionSchema>;

export const VocabularySchema = z.object({
  schema_version: z.literal(1),
  product: z.string().optional(),
  types: z.record(z.string(), TypeSpecSchema),
  verbs: z.record(z.string(), VerbSpecSchema),
  widget: WidgetVocabularySchema,
  conversions: z.array(ConversionSchema).optional(),
});

/** The JSON shape of `vocabulary.json`, exactly as Go's `pbuichat.Vocabulary` reads it. */
export type Vocabulary = z.infer<typeof VocabularySchema>;

/* ---- the widget document ------------------------------------------------- */

const ToneSchema = z.string();

const TextChildSchema = z.object({
  kind: z.literal("text"),
  text: z.string(),
  markdown: z.boolean().optional(),
});

const RefsChildSchema = z.object({
  kind: z.literal("refs"),
  label: z.string().optional(),
  refs: z.array(ReferenceSchema),
});

const MeterChildSchema = z.object({
  kind: z.literal("meter"),
  label: z.string(),
  value: z.number(),
  max: z.number().optional(),
  ref: ReferenceSchema.optional(),
});

const SparklineChildSchema = z.object({
  kind: z.literal("sparkline"),
  label: z.string(),
  values: z.array(z.number()).min(1),
  ref: ReferenceSchema.optional(),
});

const SegmentedChildSchema = z.object({
  kind: z.literal("segmented"),
  label: z.string(),
  parts: z.array(z.object({ label: z.string(), value: z.number(), tone: ToneSchema.optional() })).min(1),
});

const StatChildSchema = z.object({
  kind: z.literal("stat"),
  label: z.string(),
  value: z.union([z.string(), z.number()]),
  unit: z.string().optional(),
  delta: z.union([z.string(), z.number()]).optional(),
  ref: ReferenceSchema.optional(),
});

const CalloutChildSchema = z.object({
  kind: z.literal("callout"),
  tone: ToneSchema.optional(),
  title: z.string().optional(),
  text: z.string(),
});

export const TableColumnSchema = z.object({
  name: z.string(),
  type: z.string().optional(),
});

const TableChildSchema = z.object({
  kind: z.literal("table"),
  columns: z.array(TableColumnSchema).min(1),
  rows: z.array(z.array(z.unknown())),
  docId: z.string().optional(),
  streaming: z.boolean().optional(),
});

const DiffChildSchema = z.object({
  kind: z.literal("diff"),
  hunks: z.array(
    z.object({
      id: z.string().optional(),
      header: z.string().optional(),
      lines: z.array(z.object({ op: z.enum([" ", "+", "-"]), text: z.string() })),
    }),
  ),
});

const LogChildSchema = z.object({
  kind: z.literal("log"),
  entries: z.array(z.object({ level: z.string().optional(), text: z.string(), at: z.string().optional() })),
});

export const FormFieldSchema = z.object({
  name: z.string(),
  label: z.string(),
  input: z.enum(["text", "number", "select", "object"]),
  accepts: z.array(z.string()).optional(),
  required: z.boolean().optional(),
  options: z.array(z.string()).optional(),
});

const FormChildSchema = z.object({
  kind: z.literal("form"),
  fields: z.array(FormFieldSchema).min(1),
  submitLabel: z.string().optional(),
  verb: z.record(z.string(), z.unknown()).optional(),
});

export const VerbChipSchema = z.object({
  label: z.string().min(1),
  verb: z.record(z.string(), z.unknown()),
  danger: z.boolean().optional(),
});

export type WidgetChild =
  | z.infer<typeof TextChildSchema>
  | z.infer<typeof RefsChildSchema>
  | z.infer<typeof MeterChildSchema>
  | z.infer<typeof SparklineChildSchema>
  | z.infer<typeof SegmentedChildSchema>
  | z.infer<typeof StatChildSchema>
  | z.infer<typeof CalloutChildSchema>
  | z.infer<typeof TableChildSchema>
  | z.infer<typeof DiffChildSchema>
  | z.infer<typeof LogChildSchema>
  | z.infer<typeof FormChildSchema>
  | { kind: "widget"; document: WidgetDocument };

export interface WidgetDocument {
  format: "pbui.widget";
  schema_version: 1;
  title?: string;
  tone?: string;
  layout?: WidgetLayout;
  columns?: number;
  children: WidgetChild[];
  verbs?: z.infer<typeof VerbChipSchema>[];
}

export type TableChild = z.infer<typeof TableChildSchema>;
export type FormChild = z.infer<typeof FormChildSchema>;
export type FormField = z.infer<typeof FormFieldSchema>;
export type VerbChip = z.infer<typeof VerbChipSchema>;

const WidgetChildSchema: z.ZodType<WidgetChild> = z.lazy(() =>
  z.discriminatedUnion("kind", [
    TextChildSchema,
    RefsChildSchema,
    MeterChildSchema,
    SparklineChildSchema,
    SegmentedChildSchema,
    StatChildSchema,
    CalloutChildSchema,
    TableChildSchema,
    DiffChildSchema,
    LogChildSchema,
    FormChildSchema,
    z.object({ kind: z.literal("widget"), document: WidgetDocumentSchema }),
  ]),
) as unknown as z.ZodType<WidgetChild>;

export const WidgetDocumentSchema: z.ZodType<WidgetDocument> = z.lazy(() =>
  z.object({
    format: z.literal("pbui.widget"),
    schema_version: z.literal(1),
    title: z.string().optional(),
    tone: ToneSchema.optional(),
    layout: z.enum(WIDGET_LAYOUTS).optional(),
    columns: z.number().int().positive().optional(),
    children: z.array(WidgetChildSchema).min(1),
    verbs: z.array(VerbChipSchema).optional(),
  }),
) as unknown as z.ZodType<WidgetDocument>;
