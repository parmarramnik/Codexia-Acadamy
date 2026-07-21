/**
 * Browser & Service Worker Notification Helper for Mobile & Desktop Lockscreen Reminders
 */

export async function checkNotificationPermission() {
  if (!('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission; // 'granted', 'denied', or 'default'
}

export async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      console.log('Study Planner Service Worker registered:', reg);
      return reg;
    } catch (err) {
      console.warn('Service Worker registration failed:', err);
    }
  }
  return null;
}

export async function requestLockscreenNotificationPermission() {
  if (!('Notification' in window)) {
    return { success: false, message: 'Web Notifications are not supported on this browser.' };
  }

  let permission = Notification.permission;
  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }

  if (permission === 'granted') {
    const swRegistration = await registerServiceWorker();
    return { 
      success: true, 
      permission: 'granted', 
      message: 'Lockscreen push notifications enabled successfully!',
      sw: swRegistration
    };
  } else {
    return { 
      success: false, 
      permission, 
      message: 'Notification permission was denied. Please allow notifications in your browser/device settings.' 
    };
  }
}

export async function triggerTestLockscreenNotification() {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return false;
  }

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.showNotification) {
        await reg.showNotification('Study Reminder Alert', {
          body: 'Study Planner alert: Lockscreen push notifications are working perfectly on your device!',
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          vibrate: [200, 100, 200],
          tag: 'test-notification',
          renotify: true,
          data: { url: '/planner' }
        });
        return true;
      }
    }

    // Fallback to standard web notification
    new Notification('Study Reminder Alert', {
      body: 'Study Planner alert: Lockscreen push notifications are working perfectly on your device!',
      icon: '/favicon.ico',
      vibrate: [200, 100, 200]
    });
    return true;
  } catch (err) {
    console.error('Failed to trigger notification:', err);
    return false;
  }
}

export function scheduleReminderNotification(title, body, dueDateTimeString) {
  if (!dueDateTimeString || !('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  const dueTime = new Date(dueDateTimeString).getTime();
  const now = Date.now();
  const delayMs = dueTime - now;

  if (delayMs > 0 && delayMs < 24 * 60 * 60 * 1000) { // Schedule if due within next 24 hours
    setTimeout(async () => {
      await triggerTestLockscreenNotification();
    }, delayMs);
  }
}
