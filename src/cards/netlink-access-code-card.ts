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
    :host {
      display: block;
      height: 100%;
    }

    ha-card {
      display: flex;
      flex-direction: column;
      height: 100%;
      box-sizing: border-box;
      padding: 20px;
      border-radius: 22px;
      position: relative;
      overflow: hidden;
      container-type: size;
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
      min-width: 0;
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
      flex-shrink: 0;
    }

    .title {
      font-size: 15px;
      font-weight: 600;
      letter-spacing: 0.01em;
      line-height: 1.2;
      min-width: 0;
      text-wrap: balance;
    }

    .body {
      display: grid;
      grid-template-rows: minmax(0, 1fr) auto;
      gap: 14px;
      flex: 1;
      min-height: 0;
    }

    .primary {
      display: grid;
      align-content: start;
      gap: 12px;
      min-height: 0;
    }

    .secondary {
      display: grid;
      gap: 14px;
      align-content: end;
    }

    .code {
      font-family:
        "SFMono-Regular", "SF Mono", "Roboto Mono", "Menlo", monospace;
      font-size: clamp(28px, 10cqi, 42px);
      line-height: 1;
      font-weight: 700;
      letter-spacing: 0.06em;
      margin-bottom: 14px;
      color: var(--primary-text-color);
      text-wrap: nowrap;
      overflow: hidden;
      font-variant-numeric: tabular-nums;
    }

    .code.missing {
      font-family: inherit;
      font-size: 20px;
      line-height: 1.2;
      letter-spacing: normal;
      text-wrap: balance;
      margin-bottom: 10px;
    }

    .empty-state {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 12px;
      background: color-mix(in srgb, var(--divider-color) 24%, transparent);
      color: var(--secondary-text-color);
      font-size: 13px;
      font-weight: 500;
    }

    .footer {
      display: grid;
      gap: 14px;
      align-items: start;
    }

    .meta {
      display: grid;
      gap: 8px;
      color: var(--secondary-text-color);
      font-size: 13px;
    }

    .meta-line {
      display: grid;
      grid-template-columns: 16px minmax(0, 1fr);
      align-items: center;
      gap: 10px;
      min-width: 0;
      min-height: 18px;
    }

    .meta-line ha-icon {
      display: block;
      width: 16px;
      height: 16px;
      margin-top: 1px;
    }

    .meta-line span {
      display: block;
      min-width: 0;
      line-height: 1.2;
      overflow-wrap: anywhere;
    }

    .warning {
      display: inline-flex;
      align-items: center;
      gap: 6px;
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
      line-height: 1.25;
      max-width: 100%;
      text-wrap: balance;
    }

    .actions {
      display: flex;
      gap: 8px;
    }

    button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
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

    .progress-wrap {
      display: grid;
      gap: 6px;
    }

    .progress-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      color: var(--secondary-text-color);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .progress {
      height: 10px;
      border-radius: 999px;
      overflow: hidden;
      background: color-mix(in srgb, var(--divider-color) 60%, transparent);
    }

    .progress-bar {
      height: 100%;
      background: var(--primary-color);
      border-radius: 999px;
      transition: width 0.3s ease;
      box-shadow: 0 0 14px
        color-mix(in srgb, var(--primary-color) 38%, transparent);
    }

    @container (max-width: 280px) {
      ha-card {
        padding: 12px;
      }

      .body {
        gap: 10px;
      }

      .header {
        gap: 8px;
        margin-bottom: 12px;
      }

      .icon {
        width: 30px;
        height: 30px;
        border-radius: 10px;
      }

      .title {
        font-size: 14px;
      }

      .code {
        font-size: clamp(22px, 18cqi, 30px);
        letter-spacing: 0.03em;
        margin-bottom: 12px;
      }

      .meta {
        gap: 8px;
        font-size: 12px;
      }

      .empty-state {
        font-size: 12px;
      }

      .actions {
        flex-wrap: wrap;
      }

      button {
        width: 100%;
        justify-content: center;
      }

      .warning {
        width: 100%;
        border-radius: 14px;
      }

      .progress {
        height: 8px;
      }
    }

    @container (max-height: 255px) {
      .progress-header {
        display: none;
      }

      .progress-wrap {
        gap: 0;
      }
    }

    @container (min-width: 360px) {
      .footer.has-actions {
        grid-template-columns: minmax(0, 1fr) auto;
      }

      .actions {
        justify-content: flex-end;
        align-self: start;
      }
    }

    @container (min-width: 560px) {
      ha-card {
        padding: 22px;
      }

      .code {
        font-size: clamp(32px, 7cqi, 44px);
        letter-spacing: 0.08em;
      }

      button {
        padding-inline: 14px;
      }
    }

    @container (min-height: 280px) {
      .primary {
        align-content: center;
      }

      .code {
        font-size: clamp(32px, 10cqi, 48px);
      }
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

  public getGridOptions() {
    return {
      rows: 4,
      columns: 6,
      min_rows: 4,
      min_columns: 6,
    };
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
    const hasCode = Boolean(codeEntity?.state);
    const hasValidUntil = Boolean(validUntilEntity?.state);
    const hasData = hasCode || hasValidUntil;
    const code = codeEntity?.state ?? "No code available";

    const validUntilMs = validUntilEntity
      ? new Date(validUntilEntity.state).getTime()
      : NaN;
    const validUntilText = Number.isNaN(validUntilMs)
      ? hasData
        ? "Unknown"
        : "No data"
      : formatDateTime(validUntilEntity?.state);
    const remainingText = Number.isNaN(validUntilMs)
      ? hasData
        ? "Waiting for validity data"
        : "No access code entities available"
      : formatRemaining(this.nowMs, validUntilMs);
    const progressPercent = Number.isNaN(validUntilMs)
      ? 0
      : this.progressPercent(validUntilMs);
    const isWarning =
      !Number.isNaN(validUntilMs) && this.isRolloverSoon(validUntilMs);
    const copyLabel = this.copyFeedbackUntil > this.nowMs ? "Copied" : "Copy";
    const canCopy = this.isCopyableCode(code);

    return html`
      <ha-card class="card ${isWarning ? "warning-state" : ""}">
        <div class="header">
          <ha-icon class="icon" icon=${this.config.icon}></ha-icon>
          <div class="title">${this.config.title}</div>
        </div>
        <div class="body">
          <div class="primary">
            <div class="code ${hasCode ? "" : "missing"}">${code}</div>
            ${hasData
              ? html``
              : html`
                  <div class="empty-state">
                    <ha-icon icon="mdi:information-outline"></ha-icon>
                    <span>Waiting for NetLink access code entities.</span>
                  </div>
                `}
          </div>
          <div class="secondary">
            <div class="footer ${canCopy ? "has-actions" : ""}">
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
              ${canCopy
                ? html`
                    <div class="actions">
                      <button
                        type="button"
                        @click=${(event: Event) =>
                          this.handleCopyClick(event, code)}
                      >
                        ${copyLabel}
                      </button>
                    </div>
                  `
                : html``}
            </div>
            ${isWarning
              ? html`
                  <div class="warning">
                    <ha-icon icon="mdi:clock-alert-outline"></ha-icon>
                    <span>Code changes soon</span>
                  </div>
                `
              : html``}
            ${hasValidUntil
              ? html`
                  <div class="progress-wrap">
                    <div class="progress-header">
                      <span>Cycle progress</span>
                    </div>
                    <div class="progress" aria-hidden="true">
                      <div
                        class="progress-bar"
                        style=${`width: ${progressPercent}%;`}
                      ></div>
                    </div>
                  </div>
                `
              : html``}
          </div>
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
    if (!this.isCopyableCode(code)) {
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        this.copyCodeWithFallback(code);
      }
      this.copyFeedbackUntil = Date.now() + 2500;
    } catch {
      try {
        this.copyCodeWithFallback(code);
        this.copyFeedbackUntil = Date.now() + 2500;
      } catch {
        this.copyFeedbackUntil = 0;
      }
    }
  }

  private handleCopyClick(event: Event, code: string): void {
    event.preventDefault();
    event.stopPropagation();
    void this.copyCode(code);
  }

  private isCopyableCode(code: string): boolean {
    return /^\d{4,8}$/.test(code.trim());
  }

  private copyCodeWithFallback(code: string): void {
    const textarea = document.createElement("textarea");
    textarea.value = code;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    textarea.style.pointerEvents = "none";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
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
