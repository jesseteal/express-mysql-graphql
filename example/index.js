const express = require("express");
const { mysgraphile } = require("../dist");
const rules = require("./rules.js");
const custom = require("./custom");
const app = express();
const PORT = 8181;

app.use(
  mysgraphile({
    connection: {
      database: "reaper",
      user: "root",
      password: "zxasqw12",
    },
    enable_graphiql: true,
    rules,
    ...custom,
  })
);

app.listen(PORT, () => {
  console.log(`Listening on port: ${PORT}!`);
});
