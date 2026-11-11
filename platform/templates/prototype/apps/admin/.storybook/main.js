export default { stories: ['../src/**/*.stories.js'], framework: '@storybook/html-vite', addons: [],
  core: { disableTelemetry: true }, async viteFinal(config) { return { ...config, base: './' }; } };
