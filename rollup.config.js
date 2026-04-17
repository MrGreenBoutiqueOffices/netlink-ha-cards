import replace from "@rollup/plugin-replace";
import resolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";
import { createRequire } from "module";
import { copyFileSync, mkdirSync } from "fs";
import { join } from "path";

const require = createRequire(import.meta.url);
const { version } = require("./package.json");

const isWatch = !!process.env.ROLLUP_WATCH;
const haDistPath = process.env.HA_DIST_PATH;

function copyToHA() {
  return {
    name: "copy-to-ha",
    writeBundle({ file }) {
      if (!haDistPath) return;
      mkdirSync(haDistPath, { recursive: true });
      copyFileSync(file, join(haDistPath, "netlink-ha-cards.js"));
      console.log(`[copy-to-ha] Copied to ${haDistPath}`);
    },
  };
}

export default {
  input: "src/index.ts",
  output: {
    file: "dist/netlink-ha-cards.js",
    format: "es",
    sourcemap: isWatch,
  },
  plugins: [
    replace({
      preventAssignment: true,
      __VERSION__: JSON.stringify(version),
    }),
    resolve(),
    typescript({
      tsconfig: "./tsconfig.json",
    }),
    !isWatch && terser(),
    copyToHA(),
  ],
};
