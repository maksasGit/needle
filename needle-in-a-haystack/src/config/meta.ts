export const wellConfig = { x: 6.3, z: 5.6, radius: 1, reach: 2.5, diamonds: 20 } as const;
export const metaPrices = { legs: 10, luck: 15, gold: 15, friends: 20, memory: 50, tool: [10,20,35,60] } as const;
export type MetaId = 'legs' | 'luck' | 'gold' | 'friends' | 'memory' | 'tool';
export type MetaBuffs = { legs: boolean; luck: boolean; gold: boolean; friends: boolean; memory?: boolean; tool: number };
export const emptyBuffs = (): MetaBuffs => ({legs:false,luck:false,gold:false,friends:false,memory:false,tool:0});
export const diamondIndex = (id: number) => id >= 500 && (id-500)%1000 === 0 && id < 20000 ? (id-500)/1000 : -1;
export const buffBadge = (b: MetaBuffs) => [b.legs?'➜':'',b.luck?'▣':'',b.gold?'×2':'',b.tool?['','♧','♧Ⅱ','♧Ⅲ','◉'][b.tool]:'',b.friends?'♥':'',b.memory?'↺':''].filter(Boolean).join(' ');
