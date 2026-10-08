// Regression test for layout-audit.js. Needs the `playwright` package somewhere:
//   npm i --prefix /tmp/pw-audit playwright && npx --prefix /tmp/pw-audit playwright install chromium
//   NODE_PATH=/tmp/pw-audit/node_modules node .claude/skills/pr-browser-test/layout-audit.test.cjs
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const field = (label, control, error = '') => `
  <div style="display:flex;flex-direction:column;gap:8px;flex:1">
    <label>${label}</label>${control}${error ? `<p style="margin:0;color:red">${error}</p>` : ''}
  </div>`;
const input = '<input style="height:40px" placeholder="Ej. Rigor">';
const select = '<div style="position:relative"><select style="height:40px;width:200px"><option>Medio</option></select><svg style="position:absolute;right:8px;top:12px" width="16" height="16"></svg></div>';
const row = (align, withError) => `<div style="display:flex;flex-direction:row;align-items:${align};gap:24px;width:900px">
  ${field('Criterio de evaluación', input, withError ? 'El criterio no puede quedar vacío' : '')}
  ${field('Peso relativo', select)}
</div>`;
const page = (body) => `<html><body style="margin:0;font:16px/1.5 sans-serif">${body}</body></html>`;
const fixtures = {
  'bug: items-end + error (S04)': { html: page(row('flex-end', true)), expect: ['field-row'] },
  'fix: items-start + error':     { html: page(row('flex-start', true)), expect: [] },
  'items-end, no error':          { html: page(row('flex-end', false)), expect: [] },
  'icon not centered (fe#109)':   { html: page('<div style="display:flex;flex-direction:row;gap:8px"><svg width="16" height="16"></svg><h3 style="margin:0;font-size:14px;line-height:40px">RESPUESTA IDEAL</h3></div>'), expect: ['icon-text'] },
  'icon centered':                { html: page('<div style="display:flex;align-items:center;gap:8px"><svg width="16" height="16"></svg><h3 style="margin:0;font-size:14px">RESPUESTA IDEAL</h3></div>'), expect: [] },
  'different control heights':    { html: page(`<div style="display:flex;align-items:flex-start;gap:24px">${field('A','<input style="height:40px">')}${field('B','<input style="height:52px">')}</div>`), expect: ['control-size'] },
  'stacked (mobile) is not a row':{ html: page(`<div style="display:flex;flex-direction:column">${field('A', input, 'err')}${field('B', select)}</div>`), expect: [] },
  'horizontal overflow':          { html: page('<div style="width:3000px;height:10px"></div>'), expect: ['overflow'] },
  'long word spills out of card': { html: page('<div style="width:200px;border:1px solid"><p style="margin:0">Pregunta_con_una_palabra_larguisima_que_no_se_corta_nunca</p></div>'), expect: ['content-overflow'] },
  'long word wraps (break-words)':{ html: page('<div style="width:200px"><p style="margin:0;overflow-wrap:anywhere">Pregunta_con_una_palabra_larguisima_que_no_se_corta_nunca</p></div>'), expect: [] },
  'text cut off, no ellipsis':    { html: page('<div style="width:200px;overflow:hidden;white-space:nowrap">Una consigna muy larga que no entra en la tarjeta</div>'), expect: ['clipped'] },
  'ellipsis without title':       { html: page('<div style="width:200px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">Una consigna muy larga que no entra en la tarjeta</div>'), expect: ['clipped'] },
  'ellipsis with title':          { html: page('<div title="Una consigna muy larga" style="width:200px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">Una consigna muy larga que no entra en la tarjeta</div>'), expect: [] },
  'sr-only label is not clipped': { html: page('<label style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap">Respuesta a la pregunta 1</label><textarea></textarea>'), expect: [] },
  'scroll container is fine':     { html: page('<div style="width:200px;overflow-x:auto"><div style="width:600px;height:10px"></div></div>'), expect: [] },
  'finding names harness state':  { html: page('<section data-state="contenido-largo"><div style="width:200px"><p style="margin:0">Pregunta_con_una_palabra_larguisima_que_no_se_corta_nunca</p></div></section>'), expect: ['content-overflow'], state: 'contenido-largo' },
};

(async () => {
  const audit = readFileSync(path.join(__dirname, 'layout-audit.js'), 'utf8');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  let fail = 0;
  for (const [name, { html, expect, state }] of Object.entries(fixtures)) {
    await page.setContent(html);
    const res = await page.evaluate(`(${audit})()`);
    const got = [...new Set(res.findings.map((f) => f.check))].sort();
    const ok =
      JSON.stringify(got) === JSON.stringify([...expect].sort()) &&
      (state === undefined || res.findings.every((f) => f.state === state));
    if (!ok) fail += 1;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: got [${got}]`);
  }
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
