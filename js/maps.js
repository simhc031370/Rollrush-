import { seg } from "./physics.js";

function hopper(mid, top = -8) {
  const hL = mid - 3.8;
  const hR = mid + 3.8;
  return {
    segments: [
      seg(hL, top, hL, 6.4),
      seg(hR, top, hR, 6.4),
      seg(hL, 6.4, mid - 1.55, 8.7),
      seg(hR, 6.4, mid + 1.55, 8.7),
    ],
    gate: { ax: mid - 1.6, ay: 8.88, bx: mid + 1.6, by: 8.88 },
    spawn: { x: mid, y: 0.4, width: 6.2 },
  };
}

function walls(width, height, top = -14) {
  return [seg(0.55, top, 0.55, height), seg(width - 0.55, top, width - 0.55, height)];
}

function finishPocket(mid, goalY) {
  const mouth = 1.7;
  return [
    seg(0.55, goalY - 7, mid - mouth, goalY),
    seg(15.45, goalY - 7, mid + mouth, goalY),
    seg(mid - mouth, goalY, mid - mouth, goalY + 6.5),
    seg(mid + mouth, goalY, mid + mouth, goalY + 6.5),
    seg(mid - mouth, goalY + 6.5, mid + mouth, goalY + 6.5),
  ];
}

function hexPegs(startY, rows, cols, cx, spacingX = 1.55, spacingY = 1.7) {
  const pegs = [];
  for (let row = 0; row < rows; row += 1) {
    const offset = row % 2 === 0 ? 0 : spacingX / 2;
    const n = row % 2 === 0 ? cols : cols - 1;
    for (let col = 0; col < n; col += 1) {
      pegs.push({
        x: cx - ((n - 1) * spacingX) / 2 + col * spacingX + offset / 2,
        y: startY + row * spacingY,
        r: 0.22,
      });
    }
  }
  return pegs;
}

const WIDTH = 16;
const MID = 8;

export const MAPS = [
  {
    id: "chalkboard",
    titleKo: "칠판 미끄럼",
    titleEn: "Chalkboard Slide",
    hintKo: "지그재그 경사. 수업 시작용으로 가장 무난합니다.",
    hintEn: "A zigzag slide. The most predictable classroom course.",
    width: WIDTH,
    ...(() => {
      const top = hopper(MID);
      const ramps = [];
      let y = 13.2;
      for (let i = 0; i < 8; i += 1) {
        if (i % 2 === 0) ramps.push(seg(0.55, y, 13.2, y + 4.6));
        else ramps.push(seg(15.45, y, 2.8, y + 4.6));
        y += 8.15;
      }
      const goalY = y + 6.2;
      return {
        height: goalY + 8,
        goalY,
        zoomY: goalY - 3.5,
        spawn: top.spawn,
        gate: top.gate,
        segments: [...walls(WIDTH, goalY + 8), ...top.segments, ...ramps, ...finishPocket(MID, goalY)],
        pegs: [
          { x: 5.2, y: 24.5, r: 0.28 },
          { x: 10.6, y: 32.8, r: 0.28 },
          { x: 6.1, y: 41.4, r: 0.28 },
          { x: 11.2, y: 49.6, r: 0.28 },
          { x: 5.5, y: 58.2, r: 0.28 },
        ],
        spinners: [],
      };
    })(),
  },
  {
    id: "pegboard",
    titleKo: "뽑기 칠판",
    titleEn: "Pegboard",
    hintKo: "플린코처럼 못을 부딪치며 떨어집니다. 결과가 더 고르게 섞입니다.",
    hintEn: "A plinko-style peg field. Collisions mix the order more thoroughly.",
    width: WIDTH,
    ...(() => {
      const top = hopper(MID);
      const goalY = 78;
      const shelves = [
        seg(0.55, 18.5, 6.4, 20.2),
        seg(15.45, 33.5, 9.6, 35.2),
        seg(0.55, 49.4, 6.2, 51),
        seg(15.45, 62.8, 9.8, 64.4),
      ];
      return {
        height: goalY + 8,
        goalY,
        zoomY: goalY - 3.2,
        spawn: top.spawn,
        gate: top.gate,
        segments: [...walls(WIDTH, goalY + 8), ...top.segments, ...shelves, ...finishPocket(MID, goalY)],
        pegs: hexPegs(11.2, 20, 7, MID, 1.7, 2.45),
        spinners: [],
      };
    })(),
  },
  {
    id: "labgears",
    titleKo: "과학실 톱니",
    titleEn: "Lab Gears",
    hintKo: "돌아가는 막대가 구슬을 튕깁니다. 재미 요소가 큽니다.",
    hintEn: "Spinning bars fling marbles around. More chaotic and theatrical.",
    width: WIDTH,
    ...(() => {
      const top = hopper(MID);
      const ramps = [
        seg(0.55, 14.5, 11.8, 18.8),
        seg(15.45, 28.2, 4.2, 32.4),
        seg(0.55, 43.5, 12.1, 47.6),
        seg(15.45, 58.8, 3.9, 63),
        seg(0.55, 72.4, 10.8, 76.2),
      ];
      const goalY = 86;
      return {
        height: goalY + 8,
        goalY,
        zoomY: goalY - 3.4,
        spawn: top.spawn,
        gate: top.gate,
        segments: [...walls(WIDTH, goalY + 8), ...top.segments, ...ramps, ...finishPocket(MID, goalY)],
        pegs: [
          { x: 8, y: 22.8, r: 0.3 },
          { x: 8, y: 37.5, r: 0.3 },
          { x: 8, y: 52.6, r: 0.3 },
          { x: 8, y: 67.8, r: 0.3 },
        ],
        spinners: [
          { x: 8, y: 13.6, length: 4.2, thickness: 0.22, angle: 0.3, omega: 2.3 },
          { x: 8, y: 24.8, length: 4.4, thickness: 0.22, angle: 0.4, omega: 2.4 },
          { x: 5.4, y: 40.2, length: 3.6, thickness: 0.22, angle: 1.1, omega: -2.1 },
          { x: 10.6, y: 40.2, length: 3.6, thickness: 0.22, angle: 0.2, omega: 2.1 },
          { x: 8, y: 55.6, length: 5.2, thickness: 0.22, angle: 0.7, omega: -1.8 },
          { x: 8, y: 70.5, length: 4.2, thickness: 0.22, angle: 0.1, omega: 2.6 },
        ],
      };
    })(),
  },
];

export function getMap(id) {
  return MAPS.find((map) => map.id === id) || MAPS[0];
}
