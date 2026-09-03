import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-docs", "@storybook/addon-a11y"],
  framework: { name: "@storybook/react-vite", options: {} },
  viteFinal: async (config) => ({
    ...config,
    base: "/",
    build: { ...config.build, outDir: undefined, emptyOutDir: false, lib: undefined },
  }),
};

export default config;
