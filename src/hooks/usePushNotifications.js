import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { supabase } from '../config/supabase';

// Show notifications while app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function registerForPushNotifications(session) {
  try {
    // Push notifications only work on physical devices
    if (!Device.isDevice) {
      console.log('Push notifications require a physical device');
      return null;
    }

    // Set up Android notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'JumboNow',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#418FDE',
      });
    }

    // Check / request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return null;
    }

    // Get the Expo push token
    const projectId = Constants.expiConfig?.extra?.eas?.projectId
      ?? Constants.easConfig?.projectId;

    const tokenData = await Notifications.getExpoPushTokenAsync({
      ...(projectId ? { projectId } : {}),
    });

    const pushToken = tokenData.data;

    // Save token to Supabase device_tokens table
    if (session?.user?.id && pushToken) {
      await supabase
        .from('device_tokens')
        .upsert(
          {
            user_id: session.user.id,
            token: pushToken,
            platform: Platform.OS,
          },
          { onConflict: 'token' }
        );
    }

    return pushToken;
  } catch (error) {
    // Push is best-effort — fail silently
    console.log('Push registration skipped:', error?.message);
    return null;
  }
}

export function usePushNotifications(navigationRef, session) {
  const notificationListener = useRef();
  const responseListener = useRef();

  useEffect(() => {
    if (!session) return;

    // Register for push notifications
    registerForPushNotifications(session);

    // Listen for incoming notifications (foreground)
    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        // Notification received in foreground — handler above controls display
      }
    );

    // Listen for notification taps
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;

        if (!navigationRef?.current) return;

        switch (data?.type) {
          case 'event':
            if (data.eventId) {
              navigationRef.current.navigate('EventDetail', { eventId: data.eventId });
            }
            break;
          case 'chat':
            if (data.chatId) {
              navigationRef.current.navigate('Chat', { chatId: data.chatId });
            }
            break;
          case 'free_food':
            navigationRef.current.navigate('FreeFood');
            break;
          case 'friend_request':
            navigationRef.current.navigate('Friends');
            break;
          default:
            navigationRef.current.navigate('Notifications');
            break;
        }
      }
    );

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [session, navigationRef]);
}
