/**
 * jsdom lacks the layout APIs CodeMirror measures with. None of them affect
 * what the tests assert (document text, dispatches, attributes), so they are
 * stubbed rather than polyfilled.
 */
const rect = () => ({ x: 0, y: 0, top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0, toJSON: () => ({}) });

if (typeof Range !== "undefined") {
  Range.prototype.getBoundingClientRect = rect as unknown as Range["getBoundingClientRect"];
  Range.prototype.getClientRects = (() => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] })) as unknown as Range["getClientRects"];
}
if (typeof document !== "undefined" && !document.elementFromPoint) {
  document.elementFromPoint = () => null;
}
