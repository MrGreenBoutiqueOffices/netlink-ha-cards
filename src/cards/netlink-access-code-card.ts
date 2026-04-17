import { LitElement, css, html } from "lit";
import { property, state } from "lit/decorators.js";

import type { HomeAssistant } from "../types/home-assistant";
import { formatDateTime, formatRemaining } from "../utils/formatting";
import { findStateBySuffix, registerCustomCard } from "../utils/home-assistant";

export type AccessCodePurpose = "web_login" | "signing_maintenance";

export interface AccessCodeCardConfig {
  purpose: AccessCodePurpose;
  title?: string;
  icon?: string;
  warningThresholdMinutes?: number;
}

export class NetlinkAccessCodeCard extends LitElement {
  @property({ attribute: false }) public hass?: HomeAssistant;

  @state() private config?: Required<AccessCodeCardConfig>;
  @state() private nowMs = Date.now();
  @state() private copyFeedbackUntil = 0;

  private timerId?: number;

  static styles = css`
    ha-card {
      display: block;
      padding: 20px;
      border-radius: 22px;
      position: relative;
      overflow: hidden;
      background:
        radial-gradient(
          circle at top right,
          color-mix(in srgb, var(--primary-color) 14%, transparent) 0%,
          transparent 48%
        ),
        linear-gradient(
          180deg,
          color-mix(in srgb, var(--card-background-color) 92%, white 8%) 0%,
          var(--card-background-color) 100%
        );
      box-shadow: var(--ha-card-box-shadow, none);
    }

    .card::before {
      content: "";
      position: absolute;
      inset: 0;
      border-radius: 22px;
      pointer-events: none;
      border: 1px solid
        color-mix(in srgb, var(--divider-color) 65%, transparent);
    }

    .warning-state::before {
      border-color: color-mix(
        in srgb,
        var(--warning-color, #f59e0b) 45%,
        transparent
      );
    }

    .header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 14px;
    }

    .icon {
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

    .code {
      font-family:
        "SFMono-Regular", "SF Mono", "Roboto Mono", "Menlo", monospace;
      font-size: clamp(38px, 5vw, 46px);
      line-height: 0.95;
      font-weight: 700;
      letter-spacing: 0.12em;
      margin-bottom: 16px;
      color: var(--primary-text-color);
      text-wrap: nowrap;
    }

    .meta {
      display: flex;
      flex-direction: column;
      gap: 6px;
      color: var(--secondary-text-color);
      font-size: 13px;
    }

    .meta-line {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .warning {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-top: 12px;
      padding: 6px 10px;
      border-radius: 999px;
      background: color-mix(
        in srgb,
        var(--warning-color, #f59e0b) 18%,
        transparent
      );
      color: var(--warning-color, #f59e0b);
      font-size: 12px;
      font-weight: 600;
    }

    .actions {
      display: flex;
      gap: 8px;
      margin-top: 14px;
    }

    button {
      border: 0;
      background: color-mix(in srgb, var(--primary-color) 10%, transparent);
      color: var(--primary-text-color);
      padding: 8px 12px;
      border-radius: 10px;
      font: inherit;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition:
        background 0.15s ease,
        transform 0.15s ease;
    }

    button:hover {
      background: color-mix(in srgb, var(--primary-color) 18%, transparent);
      transform: translateY(-1px);
    }

    .progress {
      margin-top: 16px;
      height: 10px;
      background: color-mix(in srgb, var(--divider-color) 60%, transparent);
      border-radius: 999px;
      overflow: hidden;
    }

    .progress-bar {
      height: 100%;
      background: var(--primary-color);
      border-radius: 999px;
      transition: width 0.3s ease;
      box-shadow: 0 0 14px
        color-mix(in srgb, var(--primary-color) 38%, transparent);
    }
  `;

  public static getStubConfig(): AccessCodeCardConfig {
    return {
      purpose: "web_login",
      title: "Web login",
      icon: "mdi:web",
      warningThresholdMinutes: 60,
    };
  }

  public static getConfigElement(): HTMLElement {
    return document.createElement("netlink-access-code-card-editor");
  }

  public connectedCallback(): void {
    super.connectedCallback();
    this.startTimer();
  }

  public disconnectedCallback(): void {
    super.disconnectedCallback();
    this.stopTimer();
  }

  public setConfig(config: AccessCodeCardConfig): void {
    if (!config?.purpose) {
      throw new Error("purpose is required");
    }

    this.config = {
      purpose: config.purpose,
      title: config.title ?? defaultTitle(config.purpose),
      icon: config.icon ?? defaultIcon(config.purpose),
      warningThresholdMinutes: config.warningThresholdMinutes ?? 60,
    };
  }

  public getCardSize(): number {
    return 3;
  }

  protected render() {
    if (!this.config) {
      return html``;
    }

    const codeEntity = findStateBySuffix(
      this.hass,
      `_${this.config.purpose}_access_code`
    );
    const validUntilEntity = findStateBySuffix(
      this.hass,
      `_${this.config.purpose}_access_code_valid_until`
    );
    const code = codeEntity?.state ?? "Not available";

    const validUntilMs = validUntilEntity
      ? new Date(validUntilEntity.state).getTime()
      : NaN;
    const validUntilText = Number.isNaN(validUntilMs)
      ? "Unknown"
      : formatDateTime(validUntilEntity?.state);
    const remainingText = Number.isNaN(validUntilMs)
      ? ""
      : formatRemaining(this.nowMs, validUntilMs);
    const progressPercent = Number.isNaN(validUntilMs)
      ? 0
      : this.progressPercent(validUntilMs);
    const isWarning =
      !Number.isNaN(validUntilMs) && this.isRolloverSoon(validUntilMs);
    const copyLabel = this.copyFeedbackUntil > this.nowMs ? "Copied" : "Copy";

    return html`
      <ha-card class="card ${isWarning ? "warning-state" : ""}">
        <div class="header">
          <ha-icon class="icon" icon=${this.config.icon}></ha-icon>
          <div class="title">${this.config.title}</div>
        </div>
        <div class="code">${code}</div>
        <div class="meta">
          <div class="meta-line">
            <ha-icon icon="mdi:calendar-clock-outline"></ha-icon>
            <span>Valid until: ${validUntilText}</span>
          </div>
          <div class="meta-line">
            <ha-icon icon="mdi:timer-sand"></ha-icon>
            <span>${remainingText}</span>
          </div>
        </div>
        ${isWarning
          ? html`
              <div class="warning">
                <ha-icon icon="mdi:clock-alert-outline"></ha-icon>
                <span>Code changes soon</span>
              </div>
            `
          : html``}
        <div class="actions">
          <button type="button" @click=${() => this.copyCode(code)}>
            ${copyLabel}
          </button>
        </div>
        <div class="progress" aria-hidden="true">
          <div
            class="progress-bar"
            style=${`width: ${progressPercent}%;`}
          ></div>
        </div>
      </ha-card>
    `;
  }

  private startTimer(): void {
    this.stopTimer();
    this.timerId = window.setInterval(() => {
      this.nowMs = Date.now();
    }, 30000);
  }

  private stopTimer(): void {
    if (this.timerId) {
      window.clearInterval(this.timerId);
      this.timerId = undefined;
    }
  }

  private isRolloverSoon(validUntilMs: number): boolean {
    const remainingMs = validUntilMs - this.nowMs;
    return (
      remainingMs > 0 &&
      remainingMs <= this.config!.warningThresholdMinutes * 60000
    );
  }

  private progressPercent(validUntilMs: number): number {
    const cycleMs = 24 * 60 * 60 * 1000;
    const validFromMs = validUntilMs - cycleMs;
    const progress = ((this.nowMs - validFromMs) / cycleMs) * 100;
    return Math.max(0, Math.min(100, progress));
  }

  private async copyCode(code: string): Promise<void> {
    if (!code || code === "Not available") {
      return;
    }

    try {
      await navigator.clipboard.writeText(code);
      this.copyFeedbackUntil = Date.now() + 2500;
    } catch {
      this.copyFeedbackUntil = 0;
    }
  }
}

function defaultTitle(purpose: AccessCodePurpose): string {
  return purpose === "signing_maintenance"
    ? "Signing maintenance"
    : "Web login";
}

function defaultIcon(purpose: AccessCodePurpose): string {
  return purpose === "signing_maintenance" ? "mdi:draw-pen" : "mdi:web";
}

customElements.define("netlink-access-code-card", NetlinkAccessCodeCard);
registerCustomCard(
  "netlink-access-code-card",
  "NetLink Access Code Card",
  "Displays the current NetLink access code with validity and rollover progress."
);
