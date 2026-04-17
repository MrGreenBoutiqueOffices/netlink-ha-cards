import { LitElement, css, html } from "lit";
import { property, state } from "lit/decorators.js";

import type { HomeAssistant } from "../types/home-assistant";
import type {
  AccessCodeCardConfig,
  AccessCodePurpose,
} from "../cards/netlink-access-code-card";

export class NetlinkAccessCodeCardEditor extends LitElement {
  @property({ attribute: false }) public hass?: HomeAssistant;

  @state() private config: AccessCodeCardConfig = {
    purpose: "web_login",
    title: "Web login",
    icon: "mdi:web",
    warningThresholdMinutes: 60,
  };

  static styles = css`
    .editor {
      display: grid;
      gap: 12px;
    }

    label {
      display: grid;
      gap: 6px;
      font-size: 13px;
      font-weight: 600;
    }

    input,
    select {
      width: 100%;
      box-sizing: border-box;
      border: 1px solid var(--divider-color);
      border-radius: 10px;
      padding: 10px 12px;
      background: var(--card-background-color);
      color: var(--primary-text-color);
      font: inherit;
      font-weight: 400;
    }
  `;

  public setConfig(config: AccessCodeCardConfig): void {
    this.config = { ...this.config, ...config };
  }

  protected render() {
    return html`
      <div class="editor">
        <label>
          Purpose
          <select @change=${this.onPurposeChange}>
            <option
              value="web_login"
              ?selected=${this.config.purpose === "web_login"}
            >
              Web login
            </option>
            <option
              value="signing_maintenance"
              ?selected=${this.config.purpose === "signing_maintenance"}
            >
              Signing maintenance
            </option>
          </select>
        </label>
        <label>
          Title
          <input
            .value=${this.config.title ?? ""}
            @input=${this.onTextInput("title")}
          />
        </label>
        <label>
          Icon
          <input
            .value=${this.config.icon ?? ""}
            @input=${this.onTextInput("icon")}
          />
        </label>
        <label>
          Warning threshold (minutes)
          <input
            type="number"
            min="1"
            max="1440"
            step="1"
            .value=${String(this.config.warningThresholdMinutes ?? 60)}
            @input=${this.onNumberInput("warningThresholdMinutes")}
          />
        </label>
      </div>
    `;
  }

  private onPurposeChange = (event: Event) => {
    const purpose = (event.target as HTMLSelectElement)
      .value as AccessCodePurpose;
    const previousPurpose = this.config.purpose;
    const next: AccessCodeCardConfig = {
      ...this.config,
      purpose,
    };

    if (
      !this.config.title ||
      this.config.title === defaultTitle(previousPurpose)
    ) {
      next.title = defaultTitle(purpose);
    }

    if (
      !this.config.icon ||
      this.config.icon === defaultIcon(previousPurpose)
    ) {
      next.icon = defaultIcon(purpose);
    }

    this.updateConfig(next);
  };

  private onTextInput =
    (key: keyof Pick<AccessCodeCardConfig, "title" | "icon">) =>
    (event: Event) => {
      this.updateConfig({
        ...this.config,
        [key]: (event.target as HTMLInputElement).value,
      });
    };

  private onNumberInput =
    (key: keyof Pick<AccessCodeCardConfig, "warningThresholdMinutes">) =>
    (event: Event) => {
      this.updateConfig({
        ...this.config,
        [key]: Number((event.target as HTMLInputElement).value) || 60,
      });
    };

  private updateConfig(next: AccessCodeCardConfig): void {
    this.config = next;
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: next },
        bubbles: true,
        composed: true,
      })
    );
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

customElements.define(
  "netlink-access-code-card-editor",
  NetlinkAccessCodeCardEditor
);
