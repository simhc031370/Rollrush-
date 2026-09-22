import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseName,
  parseRoster,
  expandMarbles,
  consolidateRoster,
  formatRoster,
  shuffle,
  filterExcluded,
  winnerRange,
} from "../js/names.js";
import { PhysicsWorld } from "../js/physics.js";
import { MarbleRace } from "../js/game.js";

describe("parseName", () => {
  it("reads a plain name", () => {
    assert.deepEqual(parseName(" 민준 "), { name: "민준", weight: 1, count: 1 });
  });

  it("reads count and weight in either order", () => {
    assert.deepEqual(parseName("서연*3"), { name: "서연", weight: 1, count: 3 });
    assert.deepEqual(parseName("하준/2"), { name: "하준", weight: 2, count: 1 });
    assert.deepEqual(parseName("지유/2*3"), { name: "지유", weight: 2, count: 3 });
    assert.deepEqual(parseName("지유*3/2"), { name: "지유", weight: 2, count: 3 });
  });

  it("ignores empty lines", () => {
    assert.equal(parseName("   "), null);
    assert.equal(parseName(""), null);
  });
});

describe("roster helpers", () => {
  it("splits commas and newlines then expands counts", () => {
    const roster = parseRoster("민준*2, 서연\n하준/2");
    assert.equal(roster.length, 3);
    const marbles = expandMarbles(roster);
    assert.deepEqual(
      marbles.map((m) => m.name),
      ["민준", "민준", "서연", "하준"],
    );
    assert.equal(marbles[3].weight, 2);
  });

  it("consolidates duplicate name/weight pairs", () => {
    const merged = consolidateRoster(parseRoster("민준*2\n민준\n서연/2\n서연/2"));
    assert.deepEqual(merged, [
      { name: "민준", weight: 1, count: 3 },
      { name: "서연", weight: 2, count: 2 },
    ]);
    assert.equal(formatRoster(merged), "민준*3\n서연/2*2");
  });

  it("shuffles without dropping names", () => {
    const input = ["a", "b", "c", "d", "e"];
    const out = shuffle(input, () => 0.2);
    assert.equal(out.length, 5);
    assert.deepEqual([...out].sort(), input);
    assert.notEqual(out, input);
  });

  it("filters excluded students from the marble list", () => {
    const marbles = expandMarbles(parseRoster("민준,서연,하준"));
    const filtered = filterExcluded(marbles, ["서연"]);
    assert.deepEqual(filtered.map((m) => m.name), ["민준", "하준"]);
  });
});

describe("winnerRange", () => {
  it("selects first, last, nth, and a clamped range", () => {
    assert.deepEqual(winnerRange("first", {}, 8), { start: 0, end: 0 });
    assert.deepEqual(winnerRange("last", {}, 8), { start: 7, end: 7 });
    assert.deepEqual(winnerRange("nth", { nth: 3 }, 8), { start: 2, end: 2 });
    assert.deepEqual(winnerRange("range", { rangeStart: 2, rangeEnd: 4 }, 8), { start: 1, end: 3 });
    assert.deepEqual(winnerRange("range", { rangeStart: 9, rangeEnd: 12 }, 5), { start: 4, end: 4 });
  });
});

describe("physics", () => {
  it("drops a marble onto a floor instead of falling through", () => {
    const world = new PhysicsWorld();
    world.segments = [{ ax: 0, ay: 10, bx: 8, by: 10 }];
    const ball = world.addBody({
      x: 4,
      y: 1,
      vx: 0,
      vy: 0,
      r: 0.3,
      mass: 1,
      angle: 0,
      omega: 0,
      active: true,
    });
    for (let i = 0; i < 180; i += 1) world.step(1 / 60);
    assert.ok(ball.y + ball.r <= 10.08, `expected floor contact, y=${ball.y}`);
    assert.ok(ball.y > 8, "marble should have fallen toward the floor");
  });
});

describe("MarbleRace ranking", () => {
  it("records the first marble to cross the goal as rank 1", () => {
    const race = new MarbleRace();
    race.setMap("chalkboard");
    race.useSkills = false;
    race.setMarbles([
      { name: "앞", weight: 1 },
      { name: "뒤", weight: 1 },
    ]);
    race.marbles[0].x = 8;
    race.marbles[0].y = race.map.goalY - 0.2;
    race.marbles[1].x = 8;
    race.marbles[1].y = 2;
    race.marbles[0].vx = 0;
    race.marbles[0].vy = 8;
    race.start();
    race.openGate();
    for (let i = 0; i < 40; i += 1) race.step(1 / 60);
    assert.equal(race.finished[0]?.name, "앞");
    assert.equal(race.winners[0]?.name, "앞");
    assert.equal(race.status, "finished");
  });

  it("treats last remaining marble as the last-place winner", () => {
    const race = new MarbleRace();
    race.useSkills = false;
    race.setMarbles([
      { name: "A", weight: 1 },
      { name: "B", weight: 1 },
    ]);
    race.setWinnerMode("last");
    race.marbles[0].y = race.map.goalY + 0.2;
    race.marbles[1].y = 4;
    race.start();
    for (let i = 0; i < 20; i += 1) race.step(1 / 60);
    assert.equal(race.winners[0]?.name, "B");
    assert.equal(race.finished.map((m) => m.name).sort().join(","), "A,B");
  });
});
