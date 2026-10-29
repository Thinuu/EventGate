import { getAssetUrl } from '../../utils/backend';

export const buildAssetUrl = (path) => getAssetUrl(path);

// Singleton AudioContext to avoid creating a new one on each tone request
let _audioCtx = null;
export const getAudioContext = () => {
  if (!_audioCtx) {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return null;
    _audioCtx = new AudioContextCtor();
  }
  // Resume if suspended (required after user interaction)
  if (_audioCtx.state === 'suspended') {
    _audioCtx.resume();
  }
  return _audioCtx;
};

export const parseScannedValue = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';

  try {
    const parsed = JSON.parse(raw);
    return parsed.attendeeToken || parsed.token || parsed.qrToken || raw;
  } catch {
    return raw;
  }
};

export const playFeedbackTone = (success) => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    // Context is already resumed if needed by getAudioContext
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.frequency.value = success ? 880 : 240;
    oscillator.type = 'sine';
    gain.gain.setValueAtTime(0.14, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.22);
  } catch {
    // Ignore browsers that require explicit audio permissions.
  }
};

export const triggerHaptic = (success) => {
  if (typeof navigator?.vibrate !== 'function') return;
  navigator.vibrate(success ? [60] : [120, 40, 120]);
};

export const toZoneKey = (value) => {
  if (value == null || value === '') return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return String(value.id || value.name || value._id || '');
};

export const getAssignedGateLabel = (user) =>
  (user?.assignedGates || []).map(toZoneKey).filter(Boolean).join(', ') || 'Any gate';

export const getAssignedZones = (user) =>
  Array.from(
    new Set(
      [
        ...(user?.assignedZones || []),
        ...(user?.assignedGates || []),
        ...(user?.responsibilities?.zoneIds || []),
      ]
        .map(toZoneKey)
        .filter(Boolean)
    )
  );

export const zoneMatchesAssignment = (zone, assignedKeys) => {
  const id = String(zone?.id || '');
  const name = String(zone?.name || '');
  return assignedKeys.includes(id) || assignedKeys.includes(name);
};

export const filterZonesForUser = (zones, user) => {
  const list = Array.isArray(zones) ? zones : [];
  const assigned = getAssignedZones(user);
  if (!assigned.length) return list;
  const filtered = list.filter((zone) => zoneMatchesAssignment(zone, assigned));
  // GET /sub/zones is already scoped; keep API results if local keys do not match.
  return filtered.length ? filtered : list;
};

export const getAssignedZoneLabel = (user) => getAssignedZones(user).join(', ') || 'Any zone';