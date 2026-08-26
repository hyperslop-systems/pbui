import { describeEngineConformance } from "./conformance";
import { createEvalEngine } from "./evalEngine";

describeEngineConformance("eval", createEvalEngine);
