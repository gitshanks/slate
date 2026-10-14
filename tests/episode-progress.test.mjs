import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  advancePointer,
  allEpisodeKeys,
  cascadeKeys,
  episodeKey,
  isComplete,
  nextUnwatched,
  stepEpisode,
  totalEpisodes,
} from "../lib/episode-progress.ts";

const SEASONS = [
  { n: 1, c: 3 },
  { n: 2, c: 2 },
];

describe("episode-progress", () => {
  it("orders episodes canonically across seasons", () => {
    assert.deepEqual(allEpisodeKeys(SEASONS), [
      "1:1",
      "1:2",
      "1:3",
      "2:1",
      "2:2",
    ]);
    assert.equal(totalEpisodes(SEASONS), 5);
    assert.equal(episodeKey(2, 3), "2:3");
  });

  it("cascades a mid-series check backwards", () => {
    assert.deepEqual(cascadeKeys(SEASONS, 2, 1), ["1:1", "1:2", "1:3", "2:1"]);
    assert.deepEqual(cascadeKeys(SEASONS, 1, 2), ["1:1", "1:2"]);
  });

  it("finds the first unwatched episode", () => {
    assert.deepEqual(
      nextUnwatched(SEASONS, new Set(["1:1", "1:2"])),
      { season: 1, episode: 3 },
    );
    assert.equal(
      nextUnwatched(
        SEASONS,
        new Set(["1:1", "1:2", "1:3", "2:1", "2:2"]),
      ),
      null,
    );
  });

  it("steps across season boundaries", () => {
    assert.deepEqual(stepEpisode(SEASONS, 1, 3, 1), { season: 2, episode: 1 });
    assert.deepEqual(stepEpisode(SEASONS, 2, 1, -1), { season: 1, episode: 3 });
    assert.equal(stepEpisode(SEASONS, 2, 2, 1), null);
    assert.equal(stepEpisode(SEASONS, 1, 1, -1), null);
  });

  it("detects series completion", () => {
    assert.equal(isComplete(SEASONS, new Set()), false);
    assert.equal(
      isComplete(SEASONS, new Set(["1:1", "1:2", "1:3", "2:1", "2:2"])),
      true,
    );
    assert.equal(isComplete([], new Set()), false);
  });

  it("advances the resume pointer monotonically", () => {
    assert.deepEqual(
      advancePointer(SEASONS, null, { season: 1, episode: 2 }),
      { season: 1, episode: 3 },
    );
    // Playing behind the pointer never rewinds it.
    assert.deepEqual(
      advancePointer(SEASONS, { season: 2, episode: 1 }, { season: 1, episode: 1 }),
      { season: 2, episode: 1 },
    );
    // Playing the finale parks on the finale.
    assert.deepEqual(
      advancePointer(SEASONS, { season: 2, episode: 1 }, { season: 2, episode: 2 }),
      { season: 2, episode: 2 },
    );
  });
});
