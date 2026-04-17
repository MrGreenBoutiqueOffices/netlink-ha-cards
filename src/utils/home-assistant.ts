import type {
  DeviceRegistryEntry,
  EntityRegistryEntry,
  HassEntity,
  HomeAssistant,
} from "../types/home-assistant";

export function registerCustomCard(
  type: string,
  name: string,
  description: string
): void {
  window.customCards = window.customCards || [];

  if (window.customCards.some((card) => card.type === type)) {
    return;
  }

  window.customCards.push({ type, name, description });
}

export function findStateBySuffix(
  hass: HomeAssistant | undefined,
  suffix: string
): HassEntity | null {
  if (!hass) {
    return null;
  }

  return (
    Object.values(hass.states).find(
      (stateObj) =>
        stateObj.entity_id.endsWith(suffix) &&
        !["unknown", "unavailable", ""].includes(stateObj.state)
    ) ?? null
  );
}

export async function loadEntityRegistry(
  hass: HomeAssistant | undefined
): Promise<EntityRegistryEntry[]> {
  if (!hass?.callWS) {
    return [];
  }

  try {
    const entries = await hass.callWS<EntityRegistryEntry[]>({
      type: "config/entity_registry/list",
    });
    return Array.isArray(entries) ? entries : [];
  } catch {
    return [];
  }
}

export async function loadDeviceRegistry(
  hass: HomeAssistant | undefined
): Promise<Map<string, DeviceRegistryEntry>> {
  if (!hass?.callWS) {
    return new Map();
  }

  try {
    const entries = await hass.callWS<DeviceRegistryEntry[]>({
      type: "config/device_registry/list",
    });
    return new Map(
      (Array.isArray(entries) ? entries : []).map((entry) => [entry.id, entry])
    );
  } catch {
    return new Map();
  }
}
