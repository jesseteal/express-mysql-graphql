# express-mysql-graphql

Create a graphql endpoint for an express.js server with MySQL backend.

## Requirements

- Node.js 18 or newer
- Express 5
- MySQL 8-compatible server

## Install

```bash
npm install @jesseteal/express-mysql-graphql
```

## Usage

In your express app:

```js
const express = require("express");
const mysqlGraphql = require("@jesseteal/express-mysql-graphql");

const app = express();

// Add your routes and middleware first.

app.use(
  mysqlGraphql({
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
import mysqlGraphql from "@jesseteal/express-mysql-graphql";

app.use(
  mysqlGraphql({
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

## Cleanup

Each mounted instance creates its own MySQL connection pool. If your app needs
to shut down gracefully, close that pool from the Express app locals:

```js
const graphqlApp = mysqlGraphql({
  connection: {
    host: process.env.MYSQL_HOST || "localhost",
    database: process.env.MYSQL_DATABASE,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASS,
  },
});

app.use(graphqlApp);

process.on("SIGTERM", async () => {
  await graphqlApp.locals.mysqlGraphql.close();
  process.exit(0);
});
```

## More

You can create your own custom types, resolvers, and mutations. (Documentation not yet available.)

## Add Insert, Update, and Delete hooks

```js
const mysqlGraphql = require("@jesseteal/express-mysql-graphql");

app.use(
  mysqlGraphql({
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

JWT middleware stores decoded token data on `req.auth`. Existing resolver paths
also tolerate `req.user` for compatibility.

```js
const mysqlGraphql = require("@jesseteal/express-mysql-graphql");

app.use(
  mysqlGraphql({
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

## Full rules example

Rules are keyed by database table name. Hook callbacks receive `{ model, db,
row, token }` where `token` is decoded JWT data from `req.auth` or `req.user`.

- Return `false` from `before_insert`, `before_update`, or `before_delete` to
  stop the mutation.
- Return a model object from `before_insert` or `before_update` to change the
  values that will be written.
- Return a SQL `where` fragment from `restrict` or `restrict_subgraph` to limit
  query results for the table.

```js
const crypto = require("node:crypto");
const mysqlGraphql = require("@jesseteal/express-mysql-graphql");

const hashPassword = (password) =>
  crypto.createHash("sha256").update(password).digest("hex");

const isAdmin = (token = {}) => token.role === "Admin";

const accountScope = (token = {}) => {
  if (isAdmin(token)) {
    return null;
  }
  return `account_id = ${Number(token.account_id || 0)}`;
};

app.use(
  mysqlGraphql({
    connection: {
      host: process.env.MYSQL_HOST || "localhost",
      database: process.env.MYSQL_DATABASE,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASS,
    },
    jwt_signature: process.env.JWT_SECRET,
    enable_graphiql: true,
    rules: {
      user: {
        restrict: accountScope,
        restrict_subgraph: accountScope,

        before_insert: async ({ model, db, token }) => {
          const existing = await db.first(
            "select id from user where email = ?",
            [model.email],
          );
          if (existing) {
            return false;
          }

          return {
            ...model,
            account_id: isAdmin(token)
              ? model.account_id
              : Number(token.account_id),
            password: hashPassword(model.password),
            created_by: token.sub,
          };
        },

        after_insert: async ({ model, db, row, token }) => {
          await db.query(
            "insert into audit_log set table_name=?, row_id=?, action=?, actor=?",
            ["user", row?.id || model.id, "create", token.sub],
          );
        },

        before_update: async ({ model, db, row, token }) => {
          if (!row) {
            return false;
          }
          if (!isAdmin(token) && row.account_id !== Number(token.account_id)) {
            return false;
          }

          const next = {
            ...model,
            updated_by: token.sub,
          };

          if (model.email && model.email !== row.email) {
            const existing = await db.first(
              "select id from user where email = ? and id <> ?",
              [model.email, model.id],
            );
            if (existing) {
              return false;
            }
          }

          return next;
        },

        after_update: async ({ model, db, row, token }) => {
          await db.query(
            "insert into audit_log set table_name=?, row_id=?, action=?, actor=?",
            ["user", row.id, "update", token.sub],
          );
        },

        before_delete: async ({ model, db, token }) => {
          if (isAdmin(token)) {
            return true;
          }
          const row = await db.first(
            "select account_id from user where id = ?",
            [model.id],
          );
          return row?.account_id === Number(token.account_id);
        },

        after_delete: async ({ model, db, token }) => {
          await db.query(
            "insert into audit_log set table_name=?, row_id=?, action=?, actor=?",
            ["user", model.id, "delete", token.sub],
          );
        },
      },

      project: {
        restrict: accountScope,
        restrict_subgraph: (token) =>
          [accountScope(token), "archived_at IS NULL"]
            .filter(Boolean)
            .join(" AND ") || null,
      },
    },
  }),
);
```

## Rules template

```typescript
interface RuleParams {
  model: Record<string, any>;
  db: DbClient;
  row?: any;
  token?: Record<string, any>;
}

module.exports = {
  // only define desired actions
  restrict: (jwt) => {
    return "id=2";
  },
  before_insert: (props: RuleParams) => {
    // pre insertion validation or mutation
    // e.g. props.model.password = hash(props.model.password);
    return props.model; // return modified values
  },
  after_insert: ({ model }) => {
    // post insertion logic / logging
    console.log("inserted", { model });
  },
  before_update: ({ model }) => {
    console.log("updating", { model });
    return model;
  },
  after_update: ({ model }) => {
    console.log("updated", { model });
  },
  before_delete: () => {
    let allowDelete = true;
    return allowDelete;
  },
  after_delete: () => {
    console.log("deleted");
  },
};
```

## Graphql query example

```

  where examples:
    GQL:

      user(where: { userId: { between: [1,3] } }){
        userId
        username
      }

    additional "where:" examples:

    { userId: 1 }
    { userId: { eq : 1 }}
    { userId: { gt : 1 }}

    ...
    operands
    eq, neq, gt, gte, lt, lte, between, like

    basic 'equals'
    { userId: 1}

    IS NULL
    { userId: null }
```
