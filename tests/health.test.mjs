import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(tmpdir(), 'tripwhisper-health-'));
try {
  for (const name of ['journey', 'replan', 'health']) {
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
      .outputText.replace(/from ['"]\.\/journey['"]/g, "from './journey.mjs'")
      .replace(/from ['"]\.\/replan['"]/g, "from './replan.mjs'");
    writeFileSync(join(dir, name + '.mjs'), out);
  }
  const { generate, initialProfile } = await import(
    pathToFileURL(join(dir, 'journey.mjs'))
  );
  const { isFixedStop } = await import(pathToFileURL(join(dir, 'replan.mjs')));
  const {
    inspectJourney,
    parsePlanText,
    previewHealthFixes,
    serializeJourney,
    SAMPLE_PROBLEM_PLAN,
    journeysDifferForHealth,
  } = await import(pathToFileURL(join(dir, 'health.mjs')));

  const base = generate(initialProfile);
  const snapshot = structuredClone(base);

  const clean = inspectJourney(base);
  assert.ok(clean.every((f) => f.kind === 'info' || f.kind === 'missing-return'));
  assert.ok(clean.some((f) => f.kind === 'info'));
  assert.deepEqual(base, snapshot, 'inspect must not write the itinerary');

  const emptyHotel = structuredClone(base);
  emptyHotel.profile.hotel = '';
  const lodging = inspectJourney(emptyHotel);
  assert.ok(lodging.some((f) => f.kind === 'lodging' && f.fixable));

  const overlapping = structuredClone(base);
  overlapping.days[1].stops[1].time = '11:00';
  overlapping.days[1].stops[1].end = '13:00';
  const overlapHits = inspectJourney(overlapping);
  assert.ok(overlapHits.some((f) => f.kind === 'overlap'));
  assert.deepEqual(base, snapshot);

  const tight = structuredClone(base);
  tight.days[0].stops[1].time = '11:35';
  tight.days[0].stops[1].end = '13:00';
  const bufferHits = inspectJourney(tight);
  assert.ok(
    bufferHits.some(
      (f) => f.kind === 'locked-conflict' && f.rationale.includes('不足'),
    ),
    'buffer against a locked stop is a locked-booking conflict',
  );

  const flexBuffer = structuredClone(base);
  flexBuffer.days[1].stops[1].time = '12:10';
  flexBuffer.days[1].stops[1].end = '13:40';
  assert.ok(inspectJourney(flexBuffer).some((f) => f.kind === 'buffer'));

  const lockedClash = structuredClone(base);
  lockedClash.days[0].stops.push({
    ...lockedClash.days[0].stops[0],
    id: 'booking-clash',
    name: '冲突音乐会',
    time: '10:00',
    end: '11:00',
    kind: '我的预订',
    locked: true,
  });
  const lockedHits = inspectJourney(lockedClash);
  const bothLocked = lockedHits.find(
    (f) => f.kind === 'locked-conflict' && !f.fixable,
  );
  assert.ok(bothLocked);

  assert.throws(() => previewHealthFixes(lockedClash, [bothLocked.id]));
  assert.deepEqual(lockedClash.days[0].stops.find((s) => s.id === 'duomo').time, '09:30');

  const parsed = parsePlanText(base, SAMPLE_PROBLEM_PLAN);
  assert.deepEqual(base, snapshot, 'parse must not write the current itinerary');
  assert.equal(parsed.profile.hotel, '');
  assert.equal(parsed.days[0].stops[1].time, '10:30');
  const parsedHits = inspectJourney(parsed);
  assert.ok(parsedHits.some((f) => f.kind === 'lodging'));
  assert.ok(parsedHits.some((f) => f.kind === 'overlap'));
  assert.ok(parsedHits.some((f) => f.kind === 'buffer'));
  assert.ok(parsedHits.some((f) => f.kind === 'locked-conflict'));
  assert.ok(journeysDifferForHealth(parsed, base));

  const roundTrip = parsePlanText(base, serializeJourney(base));
  assert.equal(roundTrip.days[0].stops[0].id, 'duomo');
  assert.equal(roundTrip.days[0].stops[0].time, '09:30');
  assert.equal(roundTrip.profile.hotel, base.profile.hotel);

  assert.throws(() => parsePlanText(base, '这不是计划'), /没有识别到/);
  assert.deepEqual(base, snapshot);
  assert.throws(() => parsePlanText(base, '第9天\n09:00-10:00 测试'), /超出/);
  assert.throws(() => parsePlanText(base, '第1天\n10:00-09:00 反了'), /结束时间/);

  const preview = previewHealthFixes(
    parsed,
    parsedHits.filter((f) => f.fixable).map((f) => f.id),
    { hotel: 'Duomo area' },
  );
  assert.deepEqual(base, snapshot);
  assert.equal(parsed.days[0].stops[1].time, '10:30');
  assert.equal(preview.baseVersion, parsed.version);
  assert.equal(preview.next.version, parsed.version + 1);
  assert.equal(preview.next.profile.hotel, 'Duomo area');
  const duomo = preview.next.days[0].stops.find((s) => s.id === 'duomo');
  assert.equal(duomo.time, '09:30');
  assert.equal(duomo.end, '11:30');
  assert.equal(duomo.locked, true);
  const gallery = preview.next.days[0].stops.find((s) => s.id === 'gallery');
  assert.ok(gallery.time >= '11:45');
  assert.ok(!inspectJourney(preview.next).some((f) => f.kind === 'overlap'));
  assert.ok(!inspectJourney(preview.next).some((f) => f.kind === 'lodging'));
  assert.ok(
    preview.next.days
      .flatMap((d) => d.stops)
      .filter(isFixedStop)
      .every((s) => {
        const before = parsed.days.flatMap((d) => d.stops).find((x) => x.id === s.id);
        return !before || (before.time === s.time && before.end === s.end);
      }),
    'locked bookings and transit must stay put',
  );

  const adoptOnly = previewHealthFixes(parsed, [], { adopt: true });
  assert.equal(adoptOnly.next.days[0].stops[1].time, '10:30');
  assert.equal(parsed.days[0].stops[1].time, '10:30');

  const noReturn = structuredClone(base);
  noReturn.days[2].stops = noReturn.days[2].stops.filter((s) => s.id !== 'return');
  const returnHit = inspectJourney(noReturn).find((f) => f.kind === 'missing-return');
  const returned = previewHealthFixes(noReturn, [returnHit.id]);
  assert.ok(returned.next.days[2].stops.some((s) => s.id === 'return'));
  assert.ok(!noReturn.days[2].stops.some((s) => s.id === 'return'));

  assert.throws(() => previewHealthFixes(base, []));
  assert.deepEqual(base, snapshot);
  console.log(
    'PASS: health inspect/parse isolation, overlap buffer lodging locked-conflict, preview/confirm safety, locked stays',
  );
} finally {
  rmSync(dir, { recursive: true, force: true });
}
