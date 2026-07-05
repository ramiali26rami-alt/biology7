/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const concurrency = typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency || 4) : 4;
const memory = typeof navigator !== 'undefined' ? ((navigator as any).deviceMemory || 4) : 4;

export const isLowEndDevice = concurrency <= 2 || memory <= 1;

if (isLowEndDevice && typeof document !== 'undefined') {
  document.documentElement.classList.add('reduce-motion');
}
