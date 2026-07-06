module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        'babel-preset-expo',
        {
          // hermes-stable skips private-field transforms, but hermesc still
          // rejects `#foo` syntax during bytecode compilation.
          unstable_transformProfile: 'hermes-v0',
          // Required for web: zustand ESM middleware uses `import.meta.env`.
          unstable_transformImportMeta: true,
        },
      ],
    ],
    plugins: [
      [
        'module-resolver',
        {
          root: ['.'],
          alias: {
            '@/src': './src',
          },
        },
      ],
    ],
  };
};
