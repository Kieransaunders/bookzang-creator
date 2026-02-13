import assert from "node:assert/strict";
import test from "node:test";

import { planCleanupChunks } from "../chunkPlanner";

test("returns one chunk for short content", () => {
  const text = "Short text that fits in one request.";

  const chunks = planCleanupChunks({
    text,
    maxChunkChars: 200,
    overlapChars: 40,
  });

  assert.equal(chunks.length, 1);
  assert.equal(chunks[0]?.start, 0);
  assert.equal(chunks[0]?.end, text.length);
  assert.equal(chunks[0]?.text, text);
});

test("splits long content into bounded chunks with overlap", () => {
  const text = `${"A".repeat(220)}\n\n${"B".repeat(220)}\n\n${"C".repeat(220)}`;

  const chunks = planCleanupChunks({
    text,
    maxChunkChars: 240,
    overlapChars: 40,
  });

  assert.ok(chunks.length > 1);
  assert.equal(chunks[0]?.start, 0);
  assert.equal(chunks[chunks.length - 1]?.end, text.length);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    assert.ok(chunk.end > chunk.start);
    assert.ok(chunk.text.length <= 240);
    assert.equal(chunk.text, text.slice(chunk.start, chunk.end));

    if (i > 0) {
      const previous = chunks[i - 1];
      assert.equal(chunk.start, previous.end - 40);
    }
  }
});

test("rejects overlap equal to or larger than chunk size", () => {
  assert.throws(
    () =>
      planCleanupChunks({
        text: "abc",
        maxChunkChars: 100,
        overlapChars: 100,
      }),
    /overlap/i,
  );
});

test("rejects negative overlap", () => {
  assert.throws(
    () =>
      planCleanupChunks({
        text: "abc",
        maxChunkChars: 100,
        overlapChars: -1,
      }),
    /overlap/i,
  );
});

test("rejects non-positive maxChunkChars", () => {
  assert.throws(
    () =>
      planCleanupChunks({
        text: "abc",
        maxChunkChars: 0,
        overlapChars: 0,
      }),
    /maxChunkChars/i,
  );

  assert.throws(
    () =>
      planCleanupChunks({
        text: "abc",
        maxChunkChars: -10,
        overlapChars: 0,
      }),
    /maxChunkChars/i,
  );
});

test("rejects non-finite and non-integer planner args", () => {
  assert.throws(
    () =>
      planCleanupChunks({
        text: "abc",
        maxChunkChars: Number.POSITIVE_INFINITY,
        overlapChars: 0,
      }),
    /integer|finite|maxChunkChars/i,
  );

  assert.throws(
    () =>
      planCleanupChunks({
        text: "abc",
        maxChunkChars: 100.5,
        overlapChars: 0,
      }),
    /integer|finite|maxChunkChars/i,
  );

  assert.throws(
    () =>
      planCleanupChunks({
        text: "abc",
        maxChunkChars: 100,
        overlapChars: Number.NaN,
      }),
    /integer|finite|overlap/i,
  );

  assert.throws(
    () =>
      planCleanupChunks({
        text: "abc",
        maxChunkChars: 100,
        overlapChars: 0.25,
      }),
    /integer|finite|overlap/i,
  );
});

test("returns no chunks for empty text", () => {
  const chunks = planCleanupChunks({
    text: "",
    maxChunkChars: 100,
    overlapChars: 20,
  });

  assert.deepEqual(chunks, []);
});
