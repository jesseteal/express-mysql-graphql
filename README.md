# express-mysql-graphql

Create a graphql endpoint for an express.js server with MySQL backend.

There are still limitations and pitfalls. This is a work-in-progress.

## Install

```bash
npm install @jesseteal/express-mysql-graphql
```

## Usage

In your express app:

```js
const express = require("express");
const mysgraphile = require("@jesseteal/express-mysql-graphql");

const app = express();

// Add your routes and middleware first.

app.use(
  mysgraphile({
    connection: {
      host: process.env.MYSQL_HOST || "localhost",
      database: process.env.MYSQL_DATABASE,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASS,
    },
    enable_graphiql: true,
  }),
);

app.listen(3000);
```

You can also use TypeScript or ESM-style imports:

```ts
import mysgraphile from "@jesseteal/express-mysql-graphql";

app.use(
  mysgraphile({
    connection: {
      database: process.env.MYSQL_DATABASE,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASS,
    },
    enable_graphiql: true,
  }),
);
```

You can now query against http://servername/graphql

GraphiQL is available if `enable_graphiql` is set to true.

## More

You can create your own custom types, resolvers, and mutations. (Documentation not yet available.)

## Add Insert, Update, and Delete hooks

```js
const mysgraphile = require("@jesseteal/express-mysql-graphql");

app.use(
  mysgraphile({
    connection: {
      host: process.env.MYSQL_HOST || "localhost",
      database: process.env.MYSQL_DATABASE,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASS,
    },
    enable_graphiql: true,
    rules: {
      user: {
        before_insert: async ({ model, db }) => {
          const exists = await db.first("select id from user where email=?", [
            model.email,
          ]);
          if (exists) {
            return false;
          }
          model.password = utils.hash(model.password);
          return model;
        },
      },
    },
  }),
);
```

## Restrict table/row access by Token

```js
const mysgraphile = require("@jesseteal/express-mysql-graphql");

app.use(
  mysgraphile({
    connection: {
      host: process.env.MYSQL_HOST || "localhost",
      database: process.env.MYSQL_DATABASE,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASS,
    },
    enable_graphiql: true,
    rules: {
      user: {
        restrict: (token) => {
          if (token.role === "Admin") {
            return null;
          }
          return `id=${Number(token.sub)}`;
        },
      },
    },
  }),
);
```
