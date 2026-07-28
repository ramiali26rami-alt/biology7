/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
// Safe logging system: active in DEV mode, completely silent in production
const IS_DEV = import.meta.env.DEV;

export const logger = {
  log:   (...args: any[]) => { if (IS_DEV) console.log('[Bio]',   ...args); },
  info:  (...args: any[]) => { if (IS_DEV) console.info('[Bio]',  ...args); },
  warn:  (...args: any[]) => { if (IS_DEV) console.warn('[Bio]',  ...args); },
  error: (...args: any[]) => { if (IS_DEV) console.error('[Bio]', ...args); },
  // Critical errors should always be visible in production console
  critical: (...args: any[]) => console.error('[Bio CRITICAL]', ...args),
};
