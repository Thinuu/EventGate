// Timezone utility functions

export const getTimezoneOffset = (timezone) => {
  const timezoneOffsets = {
    'Asia/Colombo': 'UTC+5:30',
    'Asia/Kolkata': 'UTC+5:30',
    'Asia/Singapore': 'UTC+8:00',
    'Asia/Dubai': 'UTC+4:00',
    'Europe/London': 'UTC+0:00',
    'Europe/Paris': 'UTC+1:00',
    'America/New_York': 'UTC-5:00',
    'America/Los_Angeles': 'UTC-8:00',
    'Australia/Sydney': 'UTC+10:00',
    'UTC': 'UTC+0:00',
  };

  return timezoneOffsets[timezone] || 'UTC+5:30';
};

export const formatTimezoneDisplay = (timezone) => {
  const offset = getTimezoneOffset(timezone);
  return offset;
};
