import { LitElement, css, html } from "lit";
import { property, state } from "lit/decorators.js";

import type { HomeAssistant } from "../types/home-assistant";
import type { StatusCardConfig } from "../cards/netlink-status-card";

export class NetlinkStatusCardEditor extends LitElement {
  @property({ attribute: false }) public hass?: HomeAssistant;

  @state() private config: StatusCardConfig = {
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
    textarea {
      width: 100%;
      box-sizing: border-box;
      border: 1px solid var(--divider-color);
      border-radius: 10px;
      padding: 10px 12px;
      background: var(--card-background-color);
      color: var(--primary-text-color);
      font: inherit;
      font-weight: 400;
      resize: vertical;
      min-height: 42px;
    }

    .hint {
      font-size: 12px;
      color: var(--secondary-text-color);
    }
  `;

  public setConfig(config: StatusCardConfig): void {
    this.config = { ...this.config, ...config };
  }

  protected render() {
    return html`
      <div class="editor">
        <label>
          Title
          <input
            .value=${this.config.title ?? ""}
            @input=${this.onTextInput("title")}
          />
        </label>
        <label>
          Target desk height
          <input
            .value=${this.config.target_desk_height ?? ""}
            @input=${this.onTextInput("target_desk_height")}
          />
        </label>
        <label>
          Target source
          <input
            .value=${this.config.target_source ?? ""}
            @input=${this.onTextInput("target_source")}
          />
        </label>
        <label>
          Desk label
          <input
            .value=${this.config.desk_label ?? ""}
            @input=${this.onTextInput("desk_label")}
          />
        </label>
        <label>
          Display label
          <input
            .value=${this.config.display_label ?? ""}
            @input=${this.onTextInput("display_label")}
          />
        </label>
        <label>
          Error labels
          <textarea
            .value=${this.config.error_labels.join(", ")}
            @input=${this.onListInput("error_labels")}
          ></textarea>
        </label>
        <label>
          Area ids
          <textarea
            .value=${this.config.area_ids.join(", ")}
            @input=${this.onListInput("area_ids")}
          ></textarea>
        </label>
        <div class="hint">
          Use comma-separated values for labels and area ids.
        </div>
      </div>
    `;
  }

  private onTextInput =
    (
      key: keyof Pick<
        StatusCardConfig,
        | "title"
        | "target_desk_height"
        | "target_source"
        | "desk_label"
        | "display_label"
      >
    ) =>
    (event: Event) => {
      this.updateConfig({
        ...this.config,
        [key]: (event.target as HTMLInputElement).value,
      });
    };

  private onListInput =
    (key: keyof Pick<StatusCardConfig, "error_labels" | "area_ids">) =>
    (event: Event) => {
      const values = (event.target as HTMLTextAreaElement).value
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);

      this.updateConfig({
        ...this.config,
        [key]: values,
      });
    };

  private updateConfig(next: StatusCardConfig): void {
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

customElements.define("netlink-status-card-editor", NetlinkStatusCardEditor);
