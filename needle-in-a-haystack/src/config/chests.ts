export const chestBalance = {
  minWait: 180, maxWait: 300, lifetime: 30, retrySeconds: 5,
  rewards: [50, 100, 300, 1000],
  thresholds: [.25, .5, .75],
  pickupDistance: 1.8, maxPlayerHeight: 1.5,
  positions: [
    [-9, -9], [-9, -1], [-8, 4], [-2, 7], [3, 7],
    [8, 4], [8, -2], [1, -8], [0, -1], [5, 0],
  ],
} as const;
export function chestStage(remaining: number, total: number) {
  const removed = 1 - remaining / total;
  return chestBalance.thresholds.reduce((stage, threshold) => stage + Number(removed >= threshold), 0);
}
