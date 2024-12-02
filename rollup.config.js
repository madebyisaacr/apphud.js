import buble from "@rollup/plugin-buble";
import replace from "@rollup/plugin-replace";
import commonjs from "@rollup/plugin-commonjs";
import pkg from "./package.json" assert {type: "json"};
import {nodeResolve} from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";

const banner = `
  window.ApphudSDKVersion = '${pkg.version}';
`;

const minBanner = `window.ApphudSDKVersion = '${pkg.version}';`;

const input = "src/index.ts";
const outputName = "apphud";

const replaceOptions = {
  'process.env.BASE_URL': JSON.stringify(process.env.BASE_URL || 'http://localhost:3000'),
  'process.env.APPHUD_STRIPE_LIVE_KEY': JSON.stringify(process.env.APPHUD_STRIPE_LIVE_KEY),
  'process.env.APPHUD_STRIPE_TEST_KEY': JSON.stringify(process.env.APPHUD_STRIPE_TEST_KEY),
  'process.env.SUCCESS_URL': JSON.stringify(process.env.SUCCESS_URL),
  preventAssignment: true,
}

const plugins = [
  nodeResolve(),
  commonjs(),
  buble({include: ""}),
  terser(),
  typescript({compilerOptions: {lib: ["es5", "es6", "dom"], target: "es5"}}),
  replace(replaceOptions),
]
export default [
  {
    input: input,
    output: {
      name: outputName,
      file: `dist/web-${pkg.version}.min.js`,
      format: "umd",
      banner: minBanner
    },
    plugins: plugins
  },
  {
    input: input,
    output: {
      name: outputName,
      file: `../web2web/lib/apphud-${pkg.version}.esm.js`,
      format: "es",
      banner: banner,
      sourcemap: true
    },
    plugins: [
      nodeResolve(),
      commonjs(),
      buble({include: ""}),
      typescript({compilerOptions: {lib: ["es5", "es6", "dom"], target: "es5"}}),
      replace(replaceOptions),
    ]
  },
  {
    input: input,
    output: {
      name: outputName,
      file: `../web2web/public/apphud-${pkg.version}.min.js`,
      format: "umd",
      banner: banner
    },
    plugins: plugins
  },
  {
    input: input,
    output: {
      name: outputName,
      file: pkg.module,
      format: "es",
      banner: banner
    },
    plugins: plugins
  }
];
