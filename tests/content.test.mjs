import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = mkdtempSync(join(tmpdir(), 'tripwhisper-content-'));
try {
  for (const name of ['journey', 'content']) {
    const text = readFileSync(
      new URL('../lib/' + name + '.ts', import.meta.url),
      'utf8',
    );
    const out = ts
      .transpileModule(text, {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
        },
      })
      .outputText.replace(/from ['"]\.\/journey['"]/g, "from './journey.mjs'");
    writeFileSync(join(dir, name + '.mjs'), out);
  }
  const {
    DEMO_CONTENT_FETCHED_AT,
    YESMILANO,
    costCaption,
    explorePlaceCards,
    exportTripPayload,
    formatFetchedAt,
    handbookTransportCards,
    labelStopForExport,
    originLabel,
    preserveUserProvenance,
    resolveProvenance,
    statusLabel,
    stopExportLabel,
  } = await import(pathToFileURL(join(dir, 'content.mjs')));
  const { generate, initialProfile, adjust } = await import(
    pathToFileURL(join(dir, 'journey.mjs'))
  );

  const journey = generate(initialProfile);
  const demoStops = journey.days.flatMap((d) => d.stops);
  assert.ok(demoStops.length > 0);
  for (const stop of demoStops) {
    const p = resolveProvenance(stop);
    assert.equal(p.origin, 'demo');
    assert.equal(p.status, 'unverified');
    assert.match(p.sourceUrl, /^https:\/\//);
    assert.equal(p.fetchedAt, DEMO_CONTENT_FETCHED_AT);
    assert.equal(statusLabel(p.status), '待核验');
    assert.equal(originLabel(p.origin), '示范内容');
    assert.equal(stopExportLabel(stop), '示范内容 · 待核验');
    assert.match(costCaption(stop), /示范估值/);
    assert.match(costCaption(stop), /待核验，不是实时票价/);
  }

  const labeled = labelStopForExport(demoStops[0]);
  assert.equal(labeled.exportLabels.status, '待核验');
  assert.equal(labeled.exportLabels.origin, '示范内容');
  assert.equal(labeled.exportLabels.costKind, 'demo-estimate-not-live');

  for (const card of explorePlaceCards) {
    assert.equal(card.provenance.status, 'unverified');
    assert.equal(card.provenance.origin, 'demo');
    assert.match(card.provenance.sourceUrl, /^https:\/\//);
    assert.equal(card.provenance.fetchedAt, DEMO_CONTENT_FETCHED_AT);
    assert.doesNotMatch(card.desc, /是实时(营业|班次|票价|余票)/);
  }

  for (const card of handbookTransportCards) {
    assert.equal(card.provenance.status, 'unverified');
    assert.match(card.provenance.sourceUrl, /^https:\/\//);
    assert.match(card.body, /待核验|不报实时/);
  }

  const rainy = adjust(journey, 1, 'rain');
  const replaced = rainy.days[1].stops.find((s) => /-(rain|rest)$/.test(s.id));
  assert.ok(replaced);
  assert.equal(resolveProvenance(replaced).sourceUrl, YESMILANO);
  assert.equal(stopExportLabel(replaced), '示范内容 · 待核验');

  const userStop = {
    id: 'booking-test',
    time: '19:30',
    end: '21:00',
    name: '音乐会',
    local: '音乐会',
    address: 'Teatro alla Scala, Milano',
    kind: '我的预订',
    transport: '自行前往',
    cost: 38.9,
    story: '你手动录入的预订',
    tip: '以实际订单为准',
    url: 'https://www.teatroallascala.org/',
    locked: true,
  };
  assert.equal(resolveProvenance(userStop).origin, 'user');
  assert.equal(resolveProvenance(userStop).sourceUrl, userStop.url);
  assert.equal(
    formatFetchedAt(resolveProvenance(userStop).fetchedAt),
    '尚未记录核验时间',
  );
  assert.equal(stopExportLabel(userStop), '你录入的 · 待核验');
  assert.match(costCaption(userStop), /你记下的金额/);

  const untitled = { ...userStop, url: undefined };
  assert.equal(resolveProvenance(untitled).sourceUrl, '');

  const prev = {
    ...journey,
    days: journey.days.map((d, i) =>
      i === 0 ? { ...d, stops: [...d.stops, userStop] } : d,
    ),
  };
  const next = {
    ...journey,
    version: 2,
    days: journey.days.map((d, i) =>
      i === 0
        ? { ...d, stops: [...d.stops, { ...userStop, provenance: undefined }] }
        : d,
    ),
  };
  const stamped = preserveUserProvenance(
    prev,
    next,
    '2026-09-12T11:00:00.000Z',
  );
  const kept = stamped.days[0].stops.find((s) => s.id === 'booking-test');
  assert.equal(kept.provenance.origin, 'user');
  assert.equal(kept.provenance.sourceUrl, userStop.url);
  assert.equal(kept.provenance.fetchedAt, '2026-09-12T11:00:00.000Z');

  const payload = exportTripPayload(
    stamped,
    { memories: [], saved: [], expenses: [{ id: '1' }], checks: [] },
    '2026-09-12T12:00:00.000Z',
  );
  assert.match(payload.contentNotice, /待核验/);
  assert.equal(payload.expenseOrigin.originLabel, '你录入的');
  const exportedUser = payload.journey.days[0].stops.find(
    (s) => s.id === 'booking-test',
  );
  assert.equal(exportedUser.exportLabels.origin, '你录入的');
  assert.equal(exportedUser.exportLabels.status, '待核验');
  assert.equal(exportedUser.exportLabels.costKind, 'user-recorded-not-live');
  const exportedDemo = payload.journey.days[0].stops.find(
    (s) => s.id === 'duomo',
  );
  assert.equal(exportedDemo.exportLabels.origin, '示范内容');

  assert.equal(formatFetchedAt(''), '尚未记录核验时间');
  assert.equal(formatFetchedAt('not-a-date'), '尚未记录核验时间');
  assert.equal(
    formatFetchedAt(DEMO_CONTENT_FETCHED_AT),
    '2026-09-01 00:00:00 UTC',
  );

  console.log(
    'PASS: provenance status/source/time, demo vs user labels, export distinction, unverified copy',
  );
} finally {
  rmSync(dir, { recursive: true, force: true });
}
