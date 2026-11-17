export const chestBalance = {
  minWait: 180, maxWait: 300, lifetime: 30, retrySeconds: 5,
  rewards: [50, 100, 300, 1000],
  thresholds: [.25, .5, .75],
  pickupDistance: 1.8, maxPlayerHeight: 1.5,
  positions: [
    [-6.3, -6.3], [-6.3, -.7], [-5.6, 2.8], [-1.4, 4.9], [2.1, 4.9],
    [5.6, 2.8], [5.6, -1.4], [.7, -5.6], [0, -.7], [3.5, 0],
  ],
} as const;
export function chestStage(remaining: number, total: number) {
  const removed = 1 - remaining / total;
  return chestBalance.thresholds.reduce((stage, threshold) => stage + Number(removed >= threshold), 0);
}
