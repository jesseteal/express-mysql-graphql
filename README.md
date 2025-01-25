# express-mysql-graphql

Create a graphql endpoint for an express.js server with MySQL backend.

There are still limitations and pitfalls. This is a work-in-progress.

## Install

This module is not ready yet

## Usage

In your express app:

```
var express = require('express');
var mysgraphile = require('@jesseteal/express-mysql-graphql');

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

## Add Insert, Update, and Delete hooks

```
const mysgraphile = require('@jesseteal/express-mysql-graphql');

app.use(mysgraphile({
    ...(connection data),
    enable_graphiql: true,
    hooks: {
      before_insert: async ({table, model, db}) => {
        switch (table) {
          case 'user':
            var exists = await db.first('select id from user where email=?',[model.email]);
            console.log('exists',exists);
            if(exists){
              return false;
            }
            model.password = utils.hash(model.password); // hash new passwords before save
            break;
          default:

        }
        return model; // return (possibly) modified data
      }
    }
  }))
```

## Restrict table/row access by Token

```
const mysgraphile = require('@jesseteal/express-mysql-graphql');

app.use(mysgraphile({
    ...(connection data),
    enable_graphiql: true,
    access_limit: {
      user: token => {
        if(token.role === 'Admin'){
          return null;
        }
        // all other users can only pull themselves
        return 'id=' + token.sub; // return SQL where statement to add to list of others
      }
    }
  }))
```

## Roadmap

- [ ] Add usage documentation
- [ ] Limit how deep graph queries can go
- [ ] Refactor
