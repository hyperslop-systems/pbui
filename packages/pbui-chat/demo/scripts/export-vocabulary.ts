/*
 * Write the product's vocabulary to the Go tree:
 *   pnpm --filter @hyperslop-systems/pbui-chat-demo vocab
 *
 * The Go binary embeds pkg/chatserver/demo/vocabulary.json; the library's
 * exportVocabulary test asserts the TS declaration and the file agree, so
 * a descriptor change that forgets this step fails CI rather than drifting.
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { exportVocabulary } from "@hyperslop-systems/pbui-chat";
import { vocabulary } from "../src/pbui/vocabulary";

const target = path.resolve(import.meta.dirname, "../../../../pkg/chatserver/demo/vocabulary.json");
const json = `${JSON.stringify(exportVocabulary(vocabulary), null, 2)}\n`;
writeFileSync(target, json);
console.log(`wrote ${target} (${json.length} bytes)`);
