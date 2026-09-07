// Load this file with playwright_browser_run_code_unsafe(filename=absolute path).
// Requires rebuilt core/chat/sandbox/workbench Storybooks on 16014/16013/16012/16011.
async page => {
  const dir = '/home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/ttmp/2026/09/06/PBUI-STYLE-002--align-inspector-chat-and-generated-widgets-with-pbui-visual-contracts/various/screenshots';
  const report = [];
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const capture = async name => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.screenshot({ path: `${dir}/${name}.png` });
  };
  for (const width of ['wide', 'narrow']) {
    for (const panel of ['trace', 'runs', 'events', 'tools']) {
      await page.goto(`http://127.0.0.1:16013/iframe.html?id=pbui-chat-operational-panels--${panel}-${width}&viewMode=story`);
      await page.waitForTimeout(1000);
      const rows = await page.locator('[data-part="run-row"], [data-part="event-row"], [data-part="tool-row"], [data-part="trace"] li').evaluateAll(es => es.map(e => ({ width: e.clientWidth, scrollWidth: e.scrollWidth })));
      check(rows.length === 2, `${panel}/${width}: expected two seeded rows`);
      check(rows.every(r => r.scrollWidth <= r.width + 1), `${panel}/${width}: row overflow ${JSON.stringify(rows)}`);
      await capture(`${panel}-${width}-after`);
      report.push({ panel, width, rows });
      if (panel === 'tools' && width === 'narrow') {
        await page.getByRole('combobox', { name: 'which statuses to show' }).selectOption('failed');
        check(await page.locator('[data-part="tool-row"]').count() === 1, 'tool status filter');
        await page.locator('[data-part="tool-row"] summary').click();
        check((await page.locator('[data-part="tool-row"]').innerText()).includes('9007199254740993.00'), 'expanded exact tool input');
        await capture('tools-filtered-expanded');
      }
    }
  }
  await page.goto('http://127.0.0.1:16014/iframe.html?id=design-system-atoms-selectinput--skin-comparison&viewMode=story');
  await page.waitForTimeout(700);
  const geometry = await page.locator('select').evaluateAll(es => es.map(e => ({
    name: e.getAttribute('aria-label'), height: e.getBoundingClientRect().height, width: e.getBoundingClientRect().width,
    padding: getComputedStyle(e).padding, image: getComputedStyle(e).backgroundImage, appearance: getComputedStyle(e).appearance,
  })));
  for (const key of ['height', 'width', 'padding', 'image', 'appearance']) check(geometry[0][key] === geometry[1][key], `select parity: ${key}`);
  check(geometry[2].appearance === 'auto', 'explicit native appearance');
  check(await page.getByRole('combobox', { name: 'disabled framed select', exact: true }).isDisabled(), 'disabled select');
  const framed = page.getByRole('combobox', { name: 'framed select', exact: true });
  await framed.focus();
  await framed.press('ArrowDown');
  await framed.press('Enter');
  check(await framed.inputValue() === 'writer', 'native keyboard selection');
  await capture('select-keyboard');
  await page.emulateMedia({ forcedColors: 'active' });
  const forced = await page.locator('select').evaluateAll(es => es.slice(0, 2).map(e => ({ appearance: getComputedStyle(e).appearance, image: getComputedStyle(e).backgroundImage })));
  check(forced.every(e => e.appearance === 'auto' && e.image === 'none'), 'forced colors uses native arrow');
  await capture('select-forced-colors');
  await page.emulateMedia({ forcedColors: 'none' });
  report.push({ geometry, forced, keyboardValue: await framed.inputValue() });
  for (const [port, id, part] of [[16011, 'workbench-coordinationinspector--narrow', 'coordination-inspector'], [16012, 'visual-audit-sandbox-devtools--narrow-devtools', 'sandbox-repl']]) {
    await page.goto(`http://127.0.0.1:${port}/iframe.html?id=${id}&viewMode=story`);
    await page.waitForTimeout(1000);
    const bounds = await page.locator(`[data-part="${part}"]`).evaluate(e => ({ width: e.clientWidth, scrollWidth: e.scrollWidth, height: e.clientHeight, scrollHeight: e.scrollHeight }));
    check(bounds.width === bounds.scrollWidth && bounds.height === bounds.scrollHeight, `final ${part} bounds`);
    await capture(`final-${part}`);
    report.push({ part, bounds });
  }
  return report;
}
