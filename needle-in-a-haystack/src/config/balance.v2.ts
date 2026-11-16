/** EXPERIMENT ONLY. Not imported by the live game or save validator. */
export const economyV2 = {
  version: 2,
  status: 'candidate',
  player: {
    capacity: [30, 70, 130, 230, 380, 600, 900, 1300],
    movement: [80, 180, 350, 650, 1100, 1800],
    collection: [100, 220, 450, 850, 1500, 2400, 3600],
    sale: [300, 500, 750, 1100, 1600],
  },
  tools: [
    { price: 60, volume: [60, 130, 260, 500, 850], special: [100, 250, 500], rareStep: .15 },
    { price: 260, volume: [180, 380, 750, 1350, 2200], special: [180, 450, 900], rangeBase: .25, rangeStep: .25 },
    { price: 1100, volume: [450, 950, 1800, 3000, 4500], special: [400, 950, 1900], timeMultiplier: .9 },
    { price: 4200, volume: [1000, 2000, 3500, 5500], special: [900, 2000, 3500], rangeBase: 1.8, rangeStep: .35 },
  ],
  pigs: { prices: [250, 750, 1800], portion: [250, 550, 1100, 2000, 3500], speed: [200, 450, 900], speedFinalized: false },
  targetActiveMinutes: [45, 60],
} as const;

/** Revised candidate; prices are evaluated by the simulator, not live imports. */
export const economyV2Revised = {
  ...economyV2,
  revision: 2,
  tools: economyV2.tools.map((tool, index) => ({
    ...tool,
    price: [60, 2600, 9000, 16000][index],
    volume: tool.volume.map(price => Math.ceil(price * 2.5)),
    special: tool.special.map(price => Math.ceil(price * 2.5)),
  })),
};
