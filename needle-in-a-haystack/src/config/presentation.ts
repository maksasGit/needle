/** Shared, bounded presentation parameters. Gameplay never waits for these. */
export const presentation = {
  counterMs: 260, pulseMs: 220, cardMs: 180, purchaseGuardMs: 320,
  coinMs: 520, coinStaggerMs: 32, maxCoins: 8, pulseScale: 1.12,
  sceneDelayMs: 80, tutorialPulseMs: 1100,
  pressMs: 100, counterPower: 3, easing: 'cubic-bezier(.2,.8,.2,1)',
  messageMs: 1050, fullMessageMs: 850,
  rejectionCooldownMs: 450,
} as const;
export const saleEvent = { minWait: 180, maxWait: 300, duration: 45 } as const;
