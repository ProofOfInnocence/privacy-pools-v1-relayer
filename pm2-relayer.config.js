// eslint-disable-next-line no-undef
module.exports = {
    apps: [
      {
        name: 'relayer',
        time: true,
        script: './dist/src/main.js',
        interpreter: 'node',
      },
    ],
  };