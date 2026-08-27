import { SANDBOX_INTENTS, SANDBOX_UI_KINDS } from "@hyperslop-systems/pbui-sandbox";
import { z } from "zod";
import { ReferenceSchema, VocabularySchema, WIDGET_LAYOUTS } from "./schemas";
import type {
  Conversion,
  SandboxVocabulary,
  TypeSpec,
  VerbFieldType,
  VerbSpec,
  Vocabulary,
  WidgetKind,
  WidgetLayout,
} from "./schemas";

export interface DefineVocabularyOptions {
  product: string;
  types: Record<string, TypeSpec>;
  verbs: Record<string, VerbSpec>;
  widgetKinds: readonly WidgetKind[];
  layouts?: readonly WidgetLayout[];
  conversions?: readonly Conversion[];
  /** Declare it to tell the model the program dialect; omit it for a product without a sandbox. */
  sandbox?: { kinds: readonly string[]; intents: readonly string[] };
}

/**
 * Build a vocabulary from the product's declarations. The result is the
 * in-memory form the validators read; `exportVocabulary` turns it into the
 * JSON the Go side embeds. Validation here mirrors Go's
 * `Vocabulary.Validate`, so a vocabulary that exports cleanly also parses.
 */
export function defineVocabulary(options: DefineVocabularyOptions): Vocabulary {
  const vocabulary: Vocabulary = {
    schema_version: 1,
    product: options.product,
    types: options.types,
    verbs: options.verbs,
    widget: {
      schema_version: 1,
      kinds: [...options.widgetKinds],
      layouts: [...(options.layouts ?? WIDGET_LAYOUTS)],
    },
    conversions: [...(options.conversions ?? [])],
    ...(options.sandbox ? { sandbox: { schema_version: 1 as const, kinds: [...options.sandbox.kinds], intents: [...options.sandbox.intents] } } : {}),
  };
  const problem = vocabularyProblem(vocabulary);
  if (problem) throw new Error(`defineVocabulary: ${problem}`);
  return vocabulary;
}

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_.-]*$/;

/** Go's `Vocabulary.Validate`, as a reason string or null. */
export function vocabularyProblem(vocabulary: Vocabulary): string | null {
  const parsed = VocabularySchema.safeParse(vocabulary);
  if (!parsed.success) return parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
  if (Object.keys(vocabulary.types).length === 0) return "vocabulary declares no types";
  for (const [name, type] of Object.entries(vocabulary.types)) {
    if (!IDENTIFIER.test(name) || name.length > 64) return `type "${name}" is not a valid identifier`;
    for (const verb of type.verbs ?? []) {
      if (!(verb in vocabulary.verbs)) return `type "${name}" lists unknown verb "${verb}"`;
    }
  }
  for (const kind of Object.keys(vocabulary.verbs)) {
    if (!IDENTIFIER.test(kind) || kind.length > 64) return `verb "${kind}" is not a valid identifier`;
  }
  for (const c of vocabulary.conversions ?? []) {
    if (!(c.from in vocabulary.types)) return `conversion from unknown type "${c.from}"`;
    if (!(c.to in vocabulary.types)) return `conversion to unknown type "${c.to}"`;
  }
  if (vocabulary.sandbox) {
    for (const kind of vocabulary.sandbox.kinds) {
      if (!(SANDBOX_UI_KINDS as readonly string[]).includes(kind)) return `sandbox kind "${kind}" is not known to this client`;
    }
    for (const intent of vocabulary.sandbox.intents) {
      if (!(SANDBOX_INTENTS as readonly string[]).includes(intent)) return `sandbox intent "${intent}" is not known to this client`;
    }
  }
  return null;
}

/**
 * The JSON document, with keys in the order Go's struct declares them so the
 * written file is stable across runs. `undefined` and empty optionals are
 * dropped the way `omitempty` drops them.
 */
export function exportVocabulary(vocabulary: Vocabulary): Vocabulary {
  const types: Record<string, TypeSpec> = {};
  for (const [name, type] of Object.entries(vocabulary.types)) {
    types[name] = compact({
      doc: type.doc,
      idHint: type.idHint,
      tone: type.tone,
      verbs: type.verbs && type.verbs.length > 0 ? [...type.verbs] : undefined,
      example: type.example,
    });
  }
  const verbs: Record<string, VerbSpec> = {};
  for (const [kind, spec] of Object.entries(vocabulary.verbs)) {
    verbs[kind] = compact({
      doc: spec.doc,
      fields: { ...spec.fields },
      danger: spec.danger ? true : undefined,
    });
  }
  return compact({
    schema_version: 1 as const,
    product: vocabulary.product || undefined,
    types,
    verbs,
    widget: compact({
      schema_version: 1 as const,
      kinds: [...vocabulary.widget.kinds],
      layouts:
        vocabulary.widget.layouts && vocabulary.widget.layouts.length > 0
          ? [...vocabulary.widget.layouts]
          : undefined,
    }),
    conversions:
      vocabulary.conversions && vocabulary.conversions.length > 0
        ? vocabulary.conversions.map((c) => ({ from: c.from, to: c.to }))
        : undefined,
    sandbox: vocabulary.sandbox
      ? (compact({ schema_version: 1 as const, kinds: [...vocabulary.sandbox.kinds], intents: [...vocabulary.sandbox.intents] }) as SandboxVocabulary)
      : undefined,
  }) as Vocabulary;
}

function compact<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}

/* ---- verbs from a zod union --------------------------------------------- */

export interface VerbDocs {
  [kind: string]: { doc: string; danger?: boolean };
}

/**
 * Derive the coarse `VerbSpec`s from the product's zod discriminated union,
 * so the vocabulary's verb fields cannot drift from the type the descriptors
 * are written against. Only the coarse wire types survive: a `z.enum` of
 * strings is `"string"`, any object that is not the `ReferenceSchema` is
 * `"object"`, an array of references is `"refs"`. `.optional()` fields gain
 * the trailing `?` Go reads.
 */
export function verbSpecsFromSchema(
  union: z.ZodDiscriminatedUnion<any> | z.ZodUnion<any>,
  docs: VerbDocs,
): Record<string, VerbSpec> {
  const out: Record<string, VerbSpec> = {};
  const options = (union as { options: readonly z.ZodObject<any>[] }).options;
  for (const option of options) {
    const shape = option.shape as Record<string, z.ZodType>;
    const kindSchema = shape.kind;
    if (!kindSchema) throw new Error("verbSpecsFromSchema: every option needs a `kind` literal");
    const kind = literalValue(kindSchema);
    const fields: Record<string, VerbFieldType> = {};
    for (const [name, field] of Object.entries(shape)) {
      if (name === "kind") continue;
      const { optional, type } = coarseType(field);
      fields[optional ? `${name}?` : name] = type;
    }
    const doc = docs[kind];
    if (!doc) throw new Error(`verbSpecsFromSchema: no doc for verb "${kind}"`);
    out[kind] = { doc: doc.doc, fields, ...(doc.danger ? { danger: true } : {}) };
  }
  return out;
}

function def(schema: z.ZodType): Record<string, any> {
  return (schema as unknown as { def: Record<string, any> }).def;
}

function literalValue(schema: z.ZodType): string {
  const d = def(schema);
  const values: unknown[] = d.values ?? [d.value];
  const [first] = values;
  if (typeof first !== "string") throw new Error("verbSpecsFromSchema: `kind` must be a string literal");
  return first;
}

function coarseType(schema: z.ZodType): { optional: boolean; type: VerbFieldType } {
  const d = def(schema);
  switch (d.type) {
    case "optional":
    case "nullable":
    case "default":
      return { ...coarseType(d.innerType), optional: true };
    case "string":
    case "enum":
    case "literal":
    case "template_literal":
      return { optional: false, type: "string" };
    case "number":
    case "int":
    case "bigint":
      return { optional: false, type: "number" };
    case "boolean":
      return { optional: false, type: "boolean" };
    case "array":
      return {
        optional: false,
        type: isReferenceSchema(d.element) ? "refs" : "object",
      };
    case "object":
      return { optional: false, type: isReferenceSchema(schema) ? "ref" : "object" };
    case "record":
    case "map":
      return { optional: false, type: "object" };
    case "any":
    case "unknown":
      return { optional: false, type: "any" };
    case "union":
      return { optional: false, type: "string" };
    default:
      throw new Error(`verbSpecsFromSchema: cannot coarsen zod type "${d.type}"`);
  }
}

function isReferenceSchema(schema: z.ZodType): boolean {
  if (schema === ReferenceSchema) return true;
  const d = def(schema);
  if (d.type !== "object") return false;
  const shape = (schema as z.ZodObject<any>).shape ?? {};
  return "type" in shape && "id" in shape && !("kind" in shape);
}
