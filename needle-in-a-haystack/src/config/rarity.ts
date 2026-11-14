/** Version 1 is part of save compatibility: do not reroll its seed/thresholds. */
export const rarityVersion = 1;
export const rarityBalance = {
  seed: 0x5eeda11,
  special: [
    { id: 'legendary', chance: 0.001, bonus: 40, color: 0xff69be, badge: '+++' },
    { id: 'rare', chance: 0.007, bonus: 12, color: 0x9655f5, badge: '++' },
    { id: 'uncommon', chance: 0.03, bonus: 3, color: 0x23e5dc, badge: '+' },
  ],
} as const;
const common = { id: 'common', chance: 0, bonus: 0, color: 0xf6ad22, badge: '' } as const;
export type StrawRarity = typeof common | typeof rarityBalance.special[number];
export const maxDiscoveryBonus = Math.max(...rarityBalance.special.map(tier => tier.bonus));

/** Stable id hashing, independent of slots, saved layout and number of reloads. */
export function strawRarity(id?: number): StrawRarity {
  if (id === undefined) return common;
  let hash = (id ^ rarityBalance.seed) >>> 0;
  hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b);
  hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35);
  const roll = ((hash ^ (hash >>> 16)) >>> 0) / 4294967296;
  let threshold = 0;
  for (const tier of rarityBalance.special) {
    threshold += tier.chance;
    if (roll < threshold) return tier;
  }
  return common;
}
