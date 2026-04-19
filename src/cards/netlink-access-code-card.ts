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
      position: relative;
      display: block;
      padding: 0;
      border-radius: 24px;
      overflow: hidden;
      container-type: inline-size;
      background:
        radial-gradient(
          circle at top right,
          rgb(255 255 255 / 0.14) 0%,
          transparent 36%
        ),
        radial-gradient(
          circle at bottom left,
          color-mix(in srgb, var(--primary-color) 14%, transparent) 0%,
          transparent 44%
        ),
        linear-gradient(
          160deg,
          color-mix(in srgb, var(--card-background-color) 92%, #0f172a 8%) 0%,
          color-mix(in srgb, var(--card-background-color) 96%, black 4%) 100%
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

    .shell {
      display: grid;
      gap: 10px;
      padding: 14px;
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      min-width: 0;
    }

    .header-main {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }

    .icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 34px;
      height: 34px;
      border-radius: 10px;
      color: color-mix(in srgb, var(--primary-color) 82%, white 18%);
      background: linear-gradient(
        180deg,
        color-mix(in srgb, var(--primary-color) 24%, transparent) 0%,
        color-mix(in srgb, var(--primary-color) 12%, transparent) 100%
      );
      box-shadow: inset 0 0 0 1px
        color-mix(in srgb, var(--primary-color) 22%, transparent);
      flex-shrink: 0;
    }

    .header-copy {
      min-width: 0;
      display: grid;
      gap: 0;
    }

    .eyebrow {
      color: var(--secondary-text-color);
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }

    .title {
      color: var(--primary-text-color);
      font-size: 14px;
      font-weight: 700;
      line-height: 1.1;
      min-width: 0;
      text-wrap: balance;
    }

    .header-tag {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 7px;
      border-radius: 999px;
      color: var(--secondary-text-color);
      background: color-mix(in srgb, var(--divider-color) 18%, transparent);
      box-shadow: inset 0 0 0 1px
        color-mix(in srgb, var(--divider-color) 40%, transparent);
      font-size: 10px;
      font-weight: 600;
      white-space: nowrap;
    }

    .body {
      display: grid;
      gap: 10px;
    }

    .hero {
      display: grid;
      gap: 8px;
      padding: 10px;
      border-radius: 14px;
      background: linear-gradient(
        180deg,
        color-mix(in srgb, var(--primary-color) 14%, transparent) 0%,
        color-mix(in srgb, var(--card-background-color) 94%, black 6%) 100%
      );
      box-shadow:
        inset 0 0 0 1px
          color-mix(in srgb, var(--primary-color) 16%, transparent),
        inset 0 1px 0 rgb(255 255 255 / 0.04);
    }

    .code-card {
      display: grid;
      gap: 2px;
      min-width: 0;
    }

    .code-label {
      color: var(--secondary-text-color);
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .code {
      font-family:
        "SFMono-Regular", "SF Mono", "Roboto Mono", "Menlo", monospace;
      font-size: clamp(22px, 8cqi, 34px);
      line-height: 0.94;
      font-weight: 700;
      letter-spacing: 0.05em;
      color: var(--primary-text-color);
      text-wrap: nowrap;
      overflow: hidden;
      font-variant-numeric: tabular-nums;
      text-shadow: 0 1px 0 rgb(255 255 255 / 0.06);
    }

    .code.missing {
      font-family: inherit;
      font-size: 15px;
      line-height: 1.2;
      letter-spacing: normal;
      text-wrap: balance;
      font-weight: 600;
    }

    .code-hint {
      color: var(--secondary-text-color);
      font-size: 11px;
      line-height: 1.25;
    }

    .empty-state {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 9px;
      border-radius: 9px;
      background: color-mix(in srgb, var(--divider-color) 18%, transparent);
      color: var(--secondary-text-color);
      font-size: 11px;
      font-weight: 500;
    }

    .actions {
      display: flex;
      gap: 6px;
    }

    button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      min-height: 32px;
      padding: 0 10px;
      border: 0;
      border-radius: 10px;
      background: linear-gradient(
        180deg,
        color-mix(in srgb, var(--primary-color) 26%, transparent) 0%,
        color-mix(in srgb, var(--primary-color) 16%, transparent) 100%
      );
      color: var(--primary-text-color);
      box-shadow:
        inset 0 0 0 1px
          color-mix(in srgb, var(--primary-color) 20%, transparent),
        0 10px 24px color-mix(in srgb, var(--primary-color) 12%, transparent);
      font: inherit;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      transition:
        background 0.15s ease,
        transform 0.15s ease,
        box-shadow 0.15s ease;
    }

    button:hover {
      background: linear-gradient(
        180deg,
        color-mix(in srgb, var(--primary-color) 32%, transparent) 0%,
        color-mix(in srgb, var(--primary-color) 20%, transparent) 100%
      );
      transform: translateY(-1px);
      box-shadow:
        inset 0 0 0 1px
          color-mix(in srgb, var(--primary-color) 28%, transparent),
        0 14px 28px color-mix(in srgb, var(--primary-color) 16%, transparent);
    }

    .facts {
      display: grid;
      gap: 6px;
    }

    .fact {
      display: grid;
      gap: 4px;
      padding: 8px 10px;
      border-radius: 12px;
      background: color-mix(in srgb, var(--divider-color) 14%, transparent);
      box-shadow: inset 0 0 0 1px
        color-mix(in srgb, var(--divider-color) 32%, transparent);
    }

    .fact-header {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
      color: var(--secondary-text-color);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .fact-header ha-icon {
      width: 16px;
      height: 16px;
      color: color-mix(in srgb, var(--primary-color) 72%, white 28%);
    }

    .fact-value {
      color: var(--primary-text-color);
      font-size: 12px;
      font-weight: 600;
      line-height: 1.2;
      overflow-wrap: anywhere;
    }

    .warning {
      display: grid;
      grid-template-columns: 18px minmax(0, 1fr);
      gap: 7px;
      align-items: start;
      padding: 8px 10px;
      border-radius: 12px;
      background: color-mix(
        in srgb,
        var(--warning-color, #f59e0b) 14%,
        transparent
      );
      box-shadow: inset 0 0 0 1px
        color-mix(in srgb, var(--warning-color, #f59e0b) 24%, transparent);
      color: var(--warning-color, #f59e0b);
      font-size: 11px;
      font-weight: 600;
      line-height: 1.35;
    }

    .warning ha-icon {
      width: 16px;
      height: 16px;
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
      height: 8px;
      border-radius: 999px;
      overflow: hidden;
      background: color-mix(in srgb, var(--divider-color) 26%, transparent);
      box-shadow: inset 0 0 0 1px
        color-mix(in srgb, var(--divider-color) 36%, transparent);
    }

    .progress-bar {
      height: 100%;
      background: linear-gradient(
        90deg,
        color-mix(in srgb, var(--primary-color) 74%, white 26%) 0%,
        var(--primary-color) 100%
      );
      border-radius: 999px;
      transition: width 0.3s ease;
      box-shadow: 0 0 18px
        color-mix(in srgb, var(--primary-color) 32%, transparent);
    }

    @container (max-width: 280px) {
      .shell {
        padding: 12px;
      }

      .body {
        gap: 8px;
      }

      .header {
        align-items: start;
        grid-template-columns: minmax(0, 1fr);
      }

      .header-tag {
        justify-self: start;
      }

      .hero {
        padding: 9px;
      }

      .code {
        font-size: clamp(19px, 15cqi, 26px);
        letter-spacing: 0.03em;
      }

      .facts {
        gap: 8px;
      }

      .actions {
        display: grid;
      }

      button {
        width: 100%;
      }

      .progress {
        height: 7px;
      }
    }

    @container (min-width: 360px) {
      .hero {
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: end;
      }

      .actions {
        justify-content: end;
        align-self: end;
      }

      .facts {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @container (min-width: 560px) {
      .shell {
        padding: 16px;
      }

      .body {
        gap: 10px;
      }

      .header {
        align-items: center;
      }

      .title {
        font-size: 15px;
      }

      .code {
        font-size: clamp(24px, 5.8cqi, 34px);
        letter-spacing: 0.06em;
      }

      .fact {
        padding: 9px 11px;
      }

      button {
        padding-inline: 12px;
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
      min_rows: 3,
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
    const progressLabel = `${Math.round(progressPercent)}%`;

    return html`
      <ha-card class="card ${isWarning ? "warning-state" : ""}">
        <div class="shell">
          <div class="header">
            <div class="header-main">
              <ha-icon class="icon" icon=${this.config.icon}></ha-icon>
              <div class="header-copy">
                <div class="eyebrow">NetLink Access</div>
                <div class="title">${this.config.title}</div>
              </div>
            </div>
            <div class="header-tag">
              ${this.config.purpose.replace("_", " ")}
            </div>
          </div>
          <div class="body">
            <div class="hero">
              <div class="code-card">
                <div class="code-label">Current code</div>
                <div class="code ${hasCode ? "" : "missing"}">${code}</div>
                ${hasData
                  ? html`<div class="code-hint">
                      Use this code before rollover.
                    </div>`
                  : html`
                      <div class="empty-state">
                        <ha-icon icon="mdi:information-outline"></ha-icon>
                        <span>Waiting for NetLink access code entities.</span>
                      </div>
                    `}
              </div>
              ${canCopy
                ? html`
                    <div class="actions">
                      <button
                        type="button"
                        @click=${(event: Event) =>
                          this.handleCopyClick(event, code)}
                      >
                        <ha-icon icon="mdi:content-copy"></ha-icon>
                        ${copyLabel}
                      </button>
                    </div>
                  `
                : html``}
            </div>
            <div class="facts">
              <div class="fact">
                <div class="fact-header">
                  <ha-icon icon="mdi:calendar-clock-outline"></ha-icon>
                  <span>Valid until</span>
                </div>
                <div class="fact-value">${validUntilText}</div>
              </div>
              <div class="fact">
                <div class="fact-header">
                  <ha-icon icon="mdi:timer-sand"></ha-icon>
                  <span>Remaining</span>
                </div>
                <div class="fact-value">${remainingText}</div>
              </div>
            </div>
            ${isWarning
              ? html`
                  <div class="warning">
                    <ha-icon icon="mdi:clock-alert-outline"></ha-icon>
                    <div>
                      Code changes soon. Replace it before the current validity
                      window ends.
                    </div>
                  </div>
                `
              : html``}
            ${hasValidUntil
              ? html`
                  <div class="progress-wrap">
                    <div class="progress-header">
                      <span>Cycle progress</span>
                      <span>${progressLabel}</span>
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
