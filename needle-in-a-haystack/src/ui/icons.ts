export const iconPaths = {
  hay: 'M3 21 12 3l9 18H3M7 20l5-13 5 13M9 17h6',
  coins: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20M14 8h-3a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4h-3M12 6v12',
  backpack: 'M5 9h14l2 12H3L5 9M8 9V6a4 4 0 0 1 8 0v3M8 14h8v4H8z',
  book: 'M3 4c3-1 6-1 9 1 3-2 6-2 9-1v16c-3-1-6-1-9 1-3-2-6-2-9-1V4M12 5v16M6 9h3M15 9h3',
  settings: 'M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1 1-3M15 12a3 3 0 1 0-6 0 3 3 0 0 0 6 0',
  help: 'M9 8a3 3 0 1 1 5 2c-2 1-2 2-2 4M12 18h.01M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20',
  pig: 'M4 9 3 4l6 3h6l6-3-1 5v8l-3 3H7l-3-3V9M8 12h.01M16 12h.01M9 15h6v3H9z',
  needle: 'M4 21 17 3c3-2 6 0 3 4L4 21M17 6l2-2',
  rake: 'M12 22V8M4 3v5h16V3M8 3v5M16 3v5',
  fork: 'M12 22V10M5 2v5c0 4 14 4 14 0V2M12 2v8',
  widefork: 'M12 22V10M3 2v7h18V2M8 2v7M16 2v7',
  vacuum: 'M3 19h9v-5h8V5h-7v5h-3v4M15 8h2M5 19v3M10 19v3',
  check: 'M4 12l5 5L20 6', lock: 'M5 10h14v11H5zM8 10V6a4 4 0 0 1 8 0v4',
  close: 'M6 6l12 12M18 6 6 18', arrow: 'M12 3v18M5 14l7 7 7-7',
} as const;
export type IconName = keyof typeof iconPaths;
export function icon(name: IconName, className = 'ui-icon') {
  return `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${iconPaths[name]}"/></svg>`;
}
