/* eslint-disable no-console */
import "./editors/netlink-access-code-card-editor";
import "./editors/netlink-status-card-editor";
import "./cards/netlink-access-code-card";
import "./cards/netlink-status-card";

declare const __VERSION__: string;

console.info(
  `%c NETLINK-HA-CARDS %c v${__VERSION__} `,
  "color: white; background: #0ea5e9; font-weight: 700;",
  "color: #0ea5e9; background: white; font-weight: 700;"
);
