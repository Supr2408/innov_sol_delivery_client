const FCM_ENDPOINT = "https://fcm.googleapis.com/fcm/send";
const FCM_SERVER_KEY = process.env.FCM_SERVER_KEY || "";

const normalizeDataPayload = (payload = {}) =>
  Object.entries(payload).reduce((accumulator, [key, value]) => {
    if (value === undefined || value === null) return accumulator;
    accumulator[key] = String(value);
    return accumulator;
  }, {});

const sendSingleFcmPush = async (deviceToken, payload) => {
  const response = await fetch(FCM_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `key=${FCM_SERVER_KEY}`,
    },
    body: JSON.stringify({
      to: deviceToken,
      priority: "high",
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: normalizeDataPayload(payload.data),
    }),
  });

  if (!response.ok) {
    throw new Error(`FCM request failed with status ${response.status}`);
  }

  return response.json();
};

export const sendPushToDeviceTokens = async (deviceTokens = [], payload = {}) => {
  const normalizedTokens = [...new Set(deviceTokens.filter(Boolean).map((token) => String(token).trim()))];

  if (!normalizedTokens.length || !FCM_SERVER_KEY) {
    return {
      sent: 0,
      failed: normalizedTokens.length,
      skipped: true,
    };
  }

  const results = await Promise.allSettled(
    normalizedTokens.map((token) => sendSingleFcmPush(token, payload)),
  );

  return {
    sent: results.filter((result) => result.status === "fulfilled").length,
    failed: results.filter((result) => result.status === "rejected").length,
    skipped: false,
  };
};
