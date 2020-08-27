# express-mysql-graphql

Create a graphql endpoint for an express.js server with MySQL backend.

There are still limitations and pitfalls. This is a work-in-progress.


## Install

This module is not ready yet

## Usage

In your express app:
```
var express = require('express');
var mysgraphile = require('mysgraphile');

var app = express();

... // <all your routes and middleware>

app.use(mysgraphile({
  connection: {
    database: process.env.MYSQL_DATABASE,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASS
  },
  enable_graphiql: true,
}))

...
```

You can now query against http://servername/graphql

GraphiQL is available if `enable_graphiql` is set to true.

## More

You can create your own custom types, resolvers, and mutations. (Documentation not yet available.)

## Roadmap
- [ ] Add usage documentation
- [ ] Limit how deep graph queries can go
- [ ] Refactor
