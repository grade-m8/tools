() => {
  // Layout audit for pr-browser-test. Pass this whole file, unchanged, as the
  // `function` argument of `browser_evaluate`. It measures the rendered page
  // (it doesn't read source code), outlines offending elements in red for the
  // next screenshot, and returns { findings, checked }.
  //
  // Checks, all in CSS pixels with a 2px tolerance:
  //   field-row   fields side by side in one row must share label top and control top
  //   control-size controls in one row must have the same height
  //   icon-text   an icon next to a single line of text must be vertically centered with it
  //   overflow    the page must not scroll horizontally
  const TOL = 2;
  const CONTROL =
    'input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select, textarea, [role=combobox]';
  const findings = [];
  const flagged = new Set();
  let checked = 0;

  const isVisible = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
  };
  const round = (n) => Math.round(n * 10) / 10;
  const text = (el) =>
    (el?.innerText || el?.getAttribute?.('aria-label') || el?.getAttribute?.('placeholder') || '')
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, 40);
  const selector = (el) => {
    if (!el) return '';
    if (el.id) return `#${el.id}`;
    const cls = [...el.classList].slice(0, 4).join('.');
    return `${el.tagName.toLowerCase()}${cls ? `.${cls}` : ''}`;
  };
  const flag = (...els) => els.filter(Boolean).forEach((el) => flagged.add(el));

  // --- field-row / control-size -------------------------------------------
  for (const row of document.querySelectorAll('body *')) {
    if (!isVisible(row)) continue;
    const cs = getComputedStyle(row);
    const isRow =
      (cs.display.includes('flex') && !cs.flexDirection.startsWith('column')) || cs.display.includes('grid');
    if (!isRow) continue;

    const cols = [...row.children]
      .filter((c) => isVisible(c) && c.querySelector(CONTROL))
      .map((c) => ({
        el: c,
        rect: c.getBoundingClientRect(),
        label: [...c.querySelectorAll('label')].find(isVisible),
        control: [...c.querySelectorAll(CONTROL)].find(isVisible),
      }))
      .filter((c) => c.control);
    if (cols.length < 2) continue;

    // Only columns actually side by side (a wrapped/stacked layout is not a row).
    const sideBySide = cols.every((a, i) =>
      cols.every((b, j) => i === j || (a.rect.top < b.rect.bottom && b.rect.top < a.rect.bottom)),
    );
    if (!sideBySide) continue;
    checked += 1;

    const fields = cols.map((c) => text(c.label) || text(c.control) || selector(c.control));
    const where = { row: selector(row), align: cs.alignItems, fields };

    const labelled = cols.filter((c) => c.label);
    if (labelled.length >= 2) {
      const tops = labelled.map((c) => c.label.getBoundingClientRect().top);
      const delta = Math.max(...tops) - Math.min(...tops);
      if (delta > TOL) {
        findings.push({ check: 'field-row', what: 'labels in the same row are not aligned', deltaPx: round(delta), ...where });
        flag(...labelled.map((c) => c.label));
      }
    }

    const controlRects = cols.map((c) => c.control.getBoundingClientRect());
    const cDelta = Math.max(...controlRects.map((r) => r.top)) - Math.min(...controlRects.map((r) => r.top));
    if (cDelta > TOL) {
      findings.push({ check: 'field-row', what: 'fields in the same row are not aligned', deltaPx: round(cDelta), ...where });
      flag(...cols.map((c) => c.control));
    }
    const hDelta = Math.max(...controlRects.map((r) => r.height)) - Math.min(...controlRects.map((r) => r.height));
    if (hDelta > TOL) {
      findings.push({ check: 'control-size', what: 'fields in the same row have different heights', deltaPx: round(hDelta), ...where });
      flag(...cols.map((c) => c.control));
    }
  }

  // --- icon-text ------------------------------------------------------------
  for (const svg of document.querySelectorAll('svg')) {
    if (!isVisible(svg)) continue;
    const parent = svg.parentElement;
    if (!parent || !isVisible(parent)) continue;
    const pcs = getComputedStyle(parent);
    if (!pcs.display.includes('flex') || pcs.flexDirection.startsWith('column')) continue;
    // Absolutely positioned icons (e.g. a select's chevron) are placed on purpose.
    if (getComputedStyle(svg).position === 'absolute') continue;

    const sibling = [...parent.children].find(
      (c) => c !== svg && c.tagName !== 'svg' && isVisible(c) && text(c),
    );
    if (!sibling) continue;
    const sRect = sibling.getBoundingClientRect();
    const lineHeight = parseFloat(getComputedStyle(sibling).lineHeight) || sRect.height;
    if (sRect.height > lineHeight * 1.5) continue; // multi-line text: centering isn't expected
    checked += 1;

    const iRect = svg.getBoundingClientRect();
    const delta = Math.abs(iRect.top + iRect.height / 2 - (sRect.top + sRect.height / 2));
    if (delta > TOL) {
      findings.push({
        check: 'icon-text',
        what: 'icon is not vertically centered with its text',
        deltaPx: round(delta),
        row: selector(parent),
        align: pcs.alignItems,
        fields: [text(sibling)],
      });
      flag(svg);
    }
  }

  // --- overflow -------------------------------------------------------------
  const doc = document.scrollingElement || document.documentElement;
  checked += 1;
  if (doc.scrollWidth > doc.clientWidth + 1) {
    const widest = [...document.querySelectorAll('body *')]
      .filter((el) => isVisible(el) && el.getBoundingClientRect().right > doc.clientWidth + 1)
      .slice(0, 3);
    findings.push({
      check: 'overflow',
      what: 'page scrolls horizontally',
      deltaPx: doc.scrollWidth - doc.clientWidth,
      row: widest.map(selector).join(', '),
      fields: widest.map(text),
    });
    flag(...widest);
  }

  // Outline offenders so the next screenshot shows them.
  document.querySelectorAll('[data-layout-audit]').forEach((el) => {
    el.style.outline = '';
    el.removeAttribute('data-layout-audit');
  });
  flagged.forEach((el) => {
    el.setAttribute('data-layout-audit', '');
    el.style.outline = '2px solid #e11d48';
    el.style.outlineOffset = '2px';
  });

  return { findings, checked, viewport: `${innerWidth}x${innerHeight}` };
}
