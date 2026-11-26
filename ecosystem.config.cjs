/* eslint-disable @typescript-eslint/no-require-imports */
require("dotenv").config();

const port = process.env.PORT || "3001";

module.exports = {
  apps: [
    {
      name: "kkval-web",
      script: "node_modules/.bin/next",
      args: `start -p ${port}`,
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "768M",
      env: {
        NODE_ENV: "production",
        PORT: port,
      },
    },
    {
      name: "kkval-worker",
      script: "node_modules/.bin/tsx",
      args: "src/worker/index.ts",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "768M",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
