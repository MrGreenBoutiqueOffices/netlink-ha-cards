export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown> & {
    friendly_name?: string;
  };
}

export interface EntityRegistryEntry {
  entity_id: string;
  area_id?: string | null;
  device_id?: string | null;
  labels?: string[] | null;
}

export interface DeviceRegistryEntry {
  id: string;
  area_id?: string | null;
  labels?: string[] | null;
}

export interface HomeAssistant {
  states: Record<string, HassEntity>;
  callWS?<T>(message: { type: string }): Promise<T>;
}

declare global {
  interface Window {
    customCards?: Array<{
      type: string;
      name: string;
      description: string;
    }>;
  }

  interface HTMLElementTagNameMap {
    "ha-card": HTMLElement;
    "ha-icon": HTMLElement;
  }
}
