/*
 * The QuickJS worker entry. One line on purpose: the library ships the
 * worker's BODY (`installQuickJsWorker`) and the consumer ships the FILE,
 * because only the consumer's bundler knows where worker assets end up —
 * a `new Worker(new URL(...))` inside a published library does not survive
 * being bundled a second time.
 */
import { installQuickJsWorker } from "@hyperslop-systems/pbui-sandbox/quickjs";

installQuickJsWorker();
