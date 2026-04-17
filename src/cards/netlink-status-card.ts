import { LitElement, css, html } from "lit";
import { property, state } from "lit/decorators.js";

import type {
  DeviceRegistryEntry,
  EntityRegistryEntry,
  HassEntity,
  HomeAssistant,
} from "../types/home-assistant";
import { normalizedNumber } from "../utils/formatting";
import {
  loadDeviceRegistry,
  loadEntityRegistry,
  registerCustomCard,
} from "../utils/home-assistant";

export interface StatusCardConfig {
  title: string;
  target_desk_height: string;
  target_source: string;
  desk_label: string;
  display_label: string;
  error_labels: string[];
  desk_height_entities: string[];
  display_source_entities: string[];
  error_entities: string[];
  area_ids: string[];
}

type Severity = "ok" | "warning" | "critical";

export class NetlinkStatusCard extends LitElement {
  @property({ attribute: false }) public hass?: HomeAssistant;

  @state() private config?: StatusCardConfig;
  @state() private registry: EntityRegistryEntry[] | null = null;
  @state() private devices = new Map<string, DeviceRegistryEntry>();
  @state() private loadingRegistry = false;

  static styles = css`
    ha-card {
      display: block;
      padding: 18px;
      border-radius: 22px;
      background:
        radial-gradient(
          circle at top right,
          color-mix(in srgb, var(--primary-color) 10%, transparent) 0%,
          transparent 42%
        ),
        var(--card-background-color);
    }

    .header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 14px;
    }

    .header-icon {
      color: var(--primary-color);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 34px;
      height: 34px;
      border-radius: 12px;
      background: color-mix(in srgb, var(--primary-color) 12%, transparent);
    }

    .title {
      font-size: 15px;
      font-weight: 600;
      letter-spacing: 0.01em;
    }

    .summary {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-bottom: 14px;
    }

    .chip {
      padding: 10px 12px;
      border-radius: 14px;
      background: color-mix(in srgb, var(--divider-color) 28%, transparent);
    }

    .chip-value {
      font-size: 24px;
      font-weight: 700;
      line-height: 1;
    }

    .chip-label {
      margin-top: 4px;
      font-size: 12px;
      color: var(--secondary-text-color);
    }

    .state-banner {
      margin-bottom: 14px;
      padding: 8px 12px;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      font-weight: 700;
    }

    .state-banner.ok {
      background: color-mix(
        in srgb,
        var(--success-color, #16a34a) 16%,
        transparent
      );
      color: var(--success-color, #16a34a);
    }

    .state-banner.warning {
      background: color-mix(
        in srgb,
        var(--warning-color, #f59e0b) 16%,
        transparent
      );
      color: var(--warning-color, #f59e0b);
    }

    .state-banner.critical {
      background: color-mix(
        in srgb,
        var(--error-color, #dc2626) 16%,
        transparent
      );
      color: var(--error-color, #dc2626);
    }

    .hint {
      margin-bottom: 14px;
      font-size: 12px;
      color: var(--secondary-text-color);
    }

    .categories {
      display: grid;
      gap: 10px;
    }

    .category {
      padding: 12px;
      border-radius: 16px;
      background: color-mix(in srgb, var(--divider-color) 16%, transparent);
    }

    .category.warning {
      background: color-mix(
        in srgb,
        var(--warning-color, #f59e0b) 10%,
        transparent
      );
    }

    .category.critical {
      background: color-mix(
        in srgb,
        var(--error-color, #dc2626) 10%,
        transparent
      );
    }

    .category-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 8px;
    }

    .category-title {
      font-size: 13px;
      font-weight: 700;
    }

    .category-count {
      min-width: 28px;
      height: 28px;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: color-mix(in srgb, var(--primary-color) 14%, transparent);
      font-size: 12px;
      font-weight: 700;
    }

    .category-empty {
      font-size: 12px;
      color: var(--secondary-text-color);
    }

    .category-list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: grid;
      gap: 6px;
    }

    li {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      padding-top: 6px;
      border-top: 1px solid
        color-mix(in srgb, var(--divider-color) 60%, transparent);
    }

    .item-name {
      font-weight: 600;
      font-size: 13px;
    }

    .item-state {
      color: var(--secondary-text-color);
      text-align: right;
      font-size: 12px;
    }
  `;

  public static getStubConfig(): StatusCardConfig {
    return {
      title: "Status",
      target_desk_height: "95 cm",
      target_source: "HDMI1",
      desk_label: "desk",
      display_label: "dell",
      error_labels: ["desk", "dell"],
      desk_height_entities: [],
      display_source_entities: [],
      error_entities: [],
      area_ids: [],
    };
  }

  public static getConfigElement(): HTMLElement {
    return document.createElement("netlink-status-card-editor");
  }

  public setConfig(config: Partial<StatusCardConfig>): void {
    this.config = {
      ...NetlinkStatusCard.getStubConfig(),
      ...config,
    };
  }

  public getCardSize(): number {
    return 4;
  }

  protected willUpdate(changedProperties: Map<PropertyKey, unknown>): void {
    if (changedProperties.has("hass")) {
      void this.ensureRegistryData();
    }
  }

  protected render() {
    if (!this.config) {
      return html``;
    }

    const deskIssues = this.deskHeightStates().filter(
      (stateObj) => !this.matchesDeskTarget(stateObj)
    );
    const sourceIssues = this.displaySourceStates().filter(
      (stateObj) => !this.matchesSourceTarget(stateObj)
    );
    const errors = this.errorStates().filter(
      (stateObj) =>
        !["", "unknown", "unavailable"].includes(stateObj.state) &&
        !stateObj.state.startsWith("timeout")
    );

    const severity = this.severity(deskIssues, sourceIssues, errors);
    const summary = [
      { label: "Desk drift", count: deskIssues.length },
      { label: "Source drift", count: sourceIssues.length },
      { label: "Errors", count: errors.length },
    ];

    return html`
      <ha-card>
        <div class="header">
          <ha-icon class="header-icon" icon="mdi:view-dashboard"></ha-icon>
          <div class="title">${this.config.title}</div>
        </div>
        <div class="state-banner ${severity}">
          <ha-icon icon=${this.statusIcon(severity)}></ha-icon>
          <span>${this.statusLabel(severity)}</span>
        </div>
        ${this.loadingRegistry && this.config.desk_height_entities.length === 0
          ? html`<div class="hint">Loading labeled entities…</div>`
          : html``}
        <div class="summary">
          ${summary.map(
            (item) => html`
              <div class="chip">
                <div class="chip-value">${item.count}</div>
                <div class="chip-label">${item.label}</div>
              </div>
            `
          )}
        </div>
        <div class="categories">
          ${this.renderCategory(
            "Errors",
            errors.length,
            errors.length > 0 ? "critical" : "ok",
            errors
          )}
          ${this.renderCategory(
            `Desk drift vs ${this.config.target_desk_height}`,
            deskIssues.length,
            deskIssues.length > 0 ? "warning" : "ok",
            deskIssues
          )}
          ${this.renderCategory(
            `Source drift vs ${this.config.target_source}`,
            sourceIssues.length,
            sourceIssues.length > 0 ? "warning" : "ok",
            sourceIssues
          )}
        </div>
      </ha-card>
    `;
  }

  private async ensureRegistryData(): Promise<void> {
    if (!this.hass || this.registry !== null || this.loadingRegistry) {
      return;
    }

    this.loadingRegistry = true;
    const [registry, devices] = await Promise.all([
      loadEntityRegistry(this.hass),
      loadDeviceRegistry(this.hass),
    ]);
    this.registry = registry;
    this.devices = devices;
    this.loadingRegistry = false;
  }

  private friendly(stateObj: HassEntity): string {
    return String(stateObj.attributes.friendly_name ?? stateObj.entity_id);
  }

  private inArea(entry: EntityRegistryEntry): boolean {
    const areas = this.config?.area_ids ?? [];
    if (areas.length === 0) {
      return true;
    }

    const deviceAreaId = entry.device_id
      ? this.devices.get(entry.device_id)?.area_id
      : null;
    return (
      areas.includes(entry.area_id ?? "") || areas.includes(deviceAreaId ?? "")
    );
  }

  private hasLabel(entry: EntityRegistryEntry, label: string): boolean {
    if (!label) {
      return false;
    }

    const entityLabels = Array.isArray(entry.labels) ? entry.labels : [];
    if (entityLabels.includes(label)) {
      return true;
    }

    if (!entry.device_id) {
      return false;
    }

    const deviceLabels = this.devices.get(entry.device_id)?.labels;
    return Array.isArray(deviceLabels) && deviceLabels.includes(label);
  }

  private statesForLabel(label: string): HassEntity[] {
    if (!this.hass || !label || !this.registry) {
      return [];
    }

    return this.registry
      .filter((entry) => this.inArea(entry) && this.hasLabel(entry, label))
      .map((entry) => this.hass?.states[entry.entity_id])
      .filter((stateObj): stateObj is HassEntity => Boolean(stateObj));
  }

  private states(entityIds: string[]): HassEntity[] {
    if (!this.hass) {
      return [];
    }

    return entityIds
      .map((entityId) => this.hass?.states[entityId])
      .filter((stateObj): stateObj is HassEntity => Boolean(stateObj));
  }

  private deskHeightStates(): HassEntity[] {
    const explicit = this.states(this.config?.desk_height_entities ?? []);
    if (explicit.length > 0) {
      return explicit;
    }

    return this.statesForLabel(this.config?.desk_label ?? "").filter(
      (stateObj) => this.friendly(stateObj).endsWith("Height")
    );
  }

  private displaySourceStates(): HassEntity[] {
    const explicit = this.states(this.config?.display_source_entities ?? []);
    if (explicit.length > 0) {
      return explicit;
    }

    return this.statesForLabel(this.config?.display_label ?? "").filter(
      (stateObj) =>
        this.friendly(stateObj).endsWith("Source") &&
        stateObj.entity_id.split(".")[0] !== "select"
    );
  }

  private errorStates(): HassEntity[] {
    const explicit = this.states(this.config?.error_entities ?? []);
    if (explicit.length > 0) {
      return explicit;
    }

    const labels = this.config?.error_labels ?? [];
    const states = labels.flatMap((label) => this.statesForLabel(label));
    const unique = new Map<string, HassEntity>();

    for (const stateObj of states) {
      if (this.friendly(stateObj).endsWith("Error")) {
        unique.set(stateObj.entity_id, stateObj);
      }
    }

    return [...unique.values()];
  }

  private matchesDeskTarget(stateObj: HassEntity): boolean {
    const targetNumber = normalizedNumber(this.config?.target_desk_height);
    const stateNumber = normalizedNumber(stateObj.state);

    if (targetNumber !== null && stateNumber !== null) {
      return Math.abs(stateNumber - targetNumber) < 0.01;
    }

    return (
      String(stateObj.state) === String(this.config?.target_desk_height ?? "")
    );
  }

  private matchesSourceTarget(stateObj: HassEntity): boolean {
    return (
      String(stateObj.state).trim().toUpperCase() ===
      String(this.config?.target_source ?? "")
        .trim()
        .toUpperCase()
    );
  }

  private severity(
    deskIssues: HassEntity[],
    sourceIssues: HassEntity[],
    errors: HassEntity[]
  ): Severity {
    if (errors.length > 0) {
      return "critical";
    }

    if (deskIssues.length + sourceIssues.length > 0) {
      return "warning";
    }

    return "ok";
  }

  private statusLabel(severity: Severity): string {
    if (severity === "critical") {
      return "Errors detected";
    }

    if (severity === "warning") {
      return "Attention needed";
    }

    return "All core checks look good";
  }

  private statusIcon(severity: Severity): string {
    if (severity === "critical") {
      return "mdi:alert-circle-outline";
    }

    if (severity === "warning") {
      return "mdi:alert-outline";
    }

    return "mdi:check-circle-outline";
  }

  private renderIssueList(states: HassEntity[]) {
    if (states.length === 0) {
      return html`<div class="category-empty">None</div>`;
    }

    return html`
      <ul class="category-list">
        ${states.slice(0, 3).map(
          (stateObj) => html`
            <li>
              <span class="item-name">${this.friendly(stateObj)}</span>
              <span class="item-state">${stateObj.state}</span>
            </li>
          `
        )}
      </ul>
    `;
  }

  private renderCategory(
    title: string,
    count: number,
    tone: Severity | "ok",
    states: HassEntity[]
  ) {
    return html`
      <section class="category ${tone}">
        <div class="category-head">
          <div class="category-title">${title}</div>
          <div class="category-count">${count}</div>
        </div>
        ${this.renderIssueList(states)}
      </section>
    `;
  }
}

customElements.define("netlink-status-card", NetlinkStatusCard);
registerCustomCard(
  "netlink-status-card",
  "NetLink Status Card",
  "Summarizes desk drift, display drift and errors for a room or site."
);
