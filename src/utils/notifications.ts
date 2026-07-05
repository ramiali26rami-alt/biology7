/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Notification scheduling utility.
 * Schedules a single browser notification at a given HH:MM time today (or tomorrow if past).
 * Stores reminder preference in localStorage under 'reminder_time'.
 */

/** Schedule a browser notification at HH:MM. If that time has passed today, schedules for tomorrow. */
export function scheduleReminderNotification(time: string, lang: 'ar' | 'en'): void {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const [hStr, mStr] = time.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);

  const now = new Date();
  const target = new Date();
  target.setHours(h, m, 0, 0);

  // If time already passed today, schedule for tomorrow
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }

  const msUntil = target.getTime() - now.getTime();

  setTimeout(() => {
    if (Notification.permission === 'granted') {
      const title = lang === 'ar' ? '📚 حان وقت المذاكرة!' : '📚 Study Time!';
      const body  = lang === 'ar'
        ? 'لا تنسَ مراجعة درس الأحياء اليوم والحفاظ على سلسلتك 🔥'
        : "Don't forget your Biology lesson today and keep your streak going! 🔥";
      new Notification(title, { body, icon: '/icon-192.png', tag: 'study-reminder' });
      // Re-schedule for the next day
      scheduleReminderNotification(time, lang);
    }
  }, msUntil);
}

/** Get stored reminder time (default 20:00). */
export function getReminderTime(): string {
  return localStorage.getItem('reminder_time') || '20:00';
}

/** Save reminder time preference. */
export function setReminderTime(time: string, lang: 'ar' | 'en'): void {
  localStorage.setItem('reminder_time', time);
  scheduleReminderNotification(time, lang);
}
