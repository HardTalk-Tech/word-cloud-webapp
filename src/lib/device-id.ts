// Per-event phone state in localStorage. No Firebase imports: used on the landing step.

export type DeviceState = {
  deviceId: string;
  registered: boolean;
  answered: boolean;
  epoch: number | null;
  name?: string;
};

const key = (eventId: string) => `ew:device:${eventId}`;

function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // randomUUID needs a secure context; plain-http LAN testing falls back to this.
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function fresh(epoch: number | null = null): DeviceState {
  return { deviceId: uuid(), registered: false, answered: false, epoch };
}

export function loadDeviceState(eventId: string): DeviceState {
  try {
    const raw = localStorage.getItem(key(eventId));
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DeviceState>;
      if (typeof parsed.deviceId === 'string' && parsed.deviceId) {
        return {
          deviceId: parsed.deviceId,
          registered: parsed.registered === true,
          answered: parsed.answered === true,
          epoch: typeof parsed.epoch === 'number' ? parsed.epoch : null,
          name: typeof parsed.name === 'string' ? parsed.name : undefined,
        };
      }
    }
  } catch {
    // Private mode / blocked storage: fall through to a fresh in-memory state.
  }
  const state = fresh();
  saveDeviceState(eventId, state);
  return state;
}

export function saveDeviceState(eventId: string, state: DeviceState): void {
  try {
    localStorage.setItem(key(eventId), JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function updateDeviceState(eventId: string, patch: Partial<DeviceState>): DeviceState {
  const next = { ...loadDeviceState(eventId), ...patch };
  saveDeviceState(eventId, next);
  return next;
}

/**
 * Compare the stored epoch with the server epoch. If the event was reset, wipe local state
 * (new device id, not registered) so the phone can register again.
 */
export function reconcileEpoch(eventId: string, serverEpoch: number): DeviceState {
  const current = loadDeviceState(eventId);
  if (current.epoch === serverEpoch) return current;
  const next =
    current.epoch === null && !current.registered
      ? { ...current, epoch: serverEpoch }
      : fresh(serverEpoch);
  saveDeviceState(eventId, next);
  return next;
}
