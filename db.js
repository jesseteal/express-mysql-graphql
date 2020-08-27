const mysql = require('mysql2');
const { makeExecutableSchema } = require('@graphql-tools/schema');
const { DateResolver, DateTimeResolver } = require('graphql-scalars');
const K = require('./constants');

/*
This file needs to be refactored!!!!!!111
 */

var config = {
  connectionLimit : 10,
}

/*
  where examples:
    GQL:
    ```
      user(where: "{ \"userId\": { \"between\": [1,3]}}"){
        userId
        username
      }
    ```
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
 */
const where_args = where => {
  const wheres = [];
  let params = [];
  if(where){
    const json = JSON.parse(where);
    for (var field in json) {
      if (json.hasOwnProperty(field)) {
        if(typeof json[field] === 'object'){
          if(json[field] === null){ // is null
            wheres.push(`${field} IS NULL`);
          } else if(json[field].eq){
            wheres.push(`${field} = ?`);
            params.push(json[field].eq)
          } else if(json[field].neq){
            wheres.push(`${field} <> ?`);
            params.push(json[field].neq)
          } else if(json[field].gt){
            wheres.push(`${field} > ?`);
            params.push(json[field].gt)
          } else if(json[field].gte){
            wheres.push(`${field} >= ?`);
            params.push(json[field].gte)
          } else if(json[field].lt){
            wheres.push(`${field} < ?`);
            params.push(json[field].lt)
          } else if(json[field].lte){
            wheres.push(`${field} <= ?`);
            params.push(json[field].lte)
          } else if(json[field].between){
            wheres.push(`${field} between ? AND ?`);
            params = params.concat(json[field].between)
          } else if(json[field].like){
            wheres.push(`${field} like ?`);
            params.push(json[field].like)
          }
        } else {
          wheres.push(`${field} = ?`);
          params.push(json[field]);
        }
      }
    }
  }
  return {
    wheres:where ? wheres.join(' AND ') : '',
    params
  };
}

const no_op = () => null

const db = {

  // store passed options in local var
  config: options => {
    config = {...config, ...options};
  },

  // connect to db if not yet connected
  init: async () => {
    if(typeof db.pool === 'undefined'){
      db.pool = await mysql.createPool(config);
    }
  },

  // pass SQL to db and return results
  query: async (...args) => {
    await db.init();
    const conn = db.pool.promise();
    return await conn.query(...args)
      .catch(console.log);
  },

  // manually disconnect
  quit: () => {
    db.pool.end();
  },

  /**
   * pull table/column data from database to construct GraphQL schema
   */
  get_schema: async (options) => {
    db.config(options.connection);
    db.init();
    const custom_types = options.custom_types || '';
    const custom_queries = options.custom_queries || '';
    const custom_mutations = options.custom_mutations || '';
    const custom_query_resolvers = options.custom_query_resolvers || no_op;
    const custom_mutation_resolvers = options.custom_mutation_resolvers || no_op;

    await db.query('SET SESSION group_concat_max_len=100000');
    const [tables] = await db.query(K.SQL_SCHEMA(config.database));
    const [relationships] = await db.query(K.SQL_RELATIONSHIPS(config.database));
    const types = tables.map(r => r.types).join('\n') + `
      scalar Date
      scalar DateTime
      type schema {
        column:  String
        type:  String
        required: Int
      }
      ${custom_types}
    `;
    const queries = `
      type Query {
        schema(table: String!): [schema]
        ${custom_queries}
        ` + tables.map(t => `${t.TABLE_NAME}(limit: Int, offset: Int, where: String, order: String): [${t.TABLE_NAME}]`).join('\n') + `
      }`;
    const mutations = `
      type Mutation {
        ${custom_mutations}
        ` + tables.map(t => `
          create${t.TABLE_NAME}(input: ${t.TABLE_NAME}Input): Int
          update${t.TABLE_NAME}(input: ${t.TABLE_NAME}Input): ${t.TABLE_NAME}
          delete${t.TABLE_NAME}(input: ${t.TABLE_NAME}Input): String
        `).join('\n') + `
      }
    `;
    const inputs = tables.map(r => r.inputs).join('\n');

    let resolvers = {
      // https://github.com/Urigo/graphql-scalars
      Date: DateResolver,
      DateTime: DateTimeResolver,
      // https://www.graphql-tools.com/docs/generate-schema
      Query: {
        // allow client to query schema data for Front-End activities
        schema: async (obj, args) => {
          if(!options.enable_schema_query){
            return null;
          }
          const { table, type } = args;
          var [rows] = await db.query(`select
              COLUMN_NAME as \`column\`
              ,case WHEN IS_NULLABLE = 'NO' AND COLUMN_KEY <> 'PRI' then 1 else 0 end as required
              ,case when DATA_TYPE IN ('bigint','int','tinyint') then 'int'
              WHEN DATA_TYPE IN ('double','float','decimal') then 'decimal'
              when DATA_TYPE in ('date','datetime') then DATA_TYPE
              else 'string' end as \`type\`
            FROM INFORMATION_SCHEMA.COLUMNS c
            where TABLE_SCHEMA='${config.database}'
              and TABLE_NAME='${table}'
            order by ORDINAL_POSITION`);
          return rows;
        },
        ...custom_query_resolvers(db)
        // <query name>: (parent, args) => {...},
        // <query name>: (parent, args) => {...},
      },
      Mutation: {
        ...custom_mutation_resolvers(db)
        // <query name>: (parent, args) => {...},
      },
      // sub resolvers
      // <parent>: {
      //   <sub query>: parent => {...},
      //   <sub query>: parent => {...},
      // },
    };


    const root = {};
    tables.forEach(t => {
      // 'get' resolver
      resolvers.Query[t.TABLE_NAME] = async (obj, args) => {
        const { limit, offset, where, order } = args;
        const { wheres, params } = where_args(where);
        var [rows] = await db.query(`select * from ${t.TABLE_NAME}
          ${where ? 'where ' + wheres : ''}
          ${order ? ('order by ' + order.replace(/[;-]/g,'')) : ''}
          ${limit ? 'limit ' + parseInt(limit,10) : ''}
          ${offset ? 'offset ' + parseInt(offset,10) : ''}
          `, params);
        return rows;
      };

      // 'create' resolver
      const createName = 'create' + t.TABLE_NAME;
      resolvers.Mutation[createName] = async (obj, args) => {
        let { input } = args;
        const columns = [];
        const values = [];
        // BEFORE INSERT
        if(options.hooks.before_insert){
          input = await options.hooks.before_insert(t.TABLE_NAME, input, db);
          if(input === false){
            return 0;
          }
        }
        for (var field in input) {
          columns.push(field);
          values.push(input[field]);
        }
        let id = await db.query(`INSERT INTO ${t.TABLE_NAME} (\`${columns.join('\`,\`')}\`) values (${columns.map(c => '?').join(',')})`,values)
          .then(r => r[0].insertId);

        if(options.hooks.after_insert){
          await options.hooks.after_insert(t.TABLE_NAME, { id, ...input }, db);
        }
        return id;
      };

      // delete resolver
      const deleteName = 'delete' + t.TABLE_NAME;
      resolvers.Mutation[deleteName] = async (obj, { input }) => {
        const keys = t.PKEYS.split(',');
        const columns = [];
        const values = [];
        let all_keys_found = true;
        keys.forEach((key, i) => {
          all_keys_found = all_keys_found && !!input[key]
          columns.push(`${key}=?`);
          values.push(input[key]);
        });
        if(all_keys_found){
          if(options.hooks.before_delete){
            const ok = await options.hooks.before_delete(t.TABLE_NAME, input, db);
            if(ok === false){
              return "Delete refused by pre-delete check";
            }
          }
          const [res] = await db.query(`DELETE FROM ${t.TABLE_NAME} WHERE ${columns.join(' AND ')}`,values);
          if(options.hooks.after_delete){
            await options.hooks.after_delete(t.TABLE_NAME, input, db);
          }
          return `${res.affectedRows} row(s) deleted.`;
        }
        return "Delete Failed - missing primary keys";
      };

      // 'update' resolver
      const updateName = 'update' + t.TABLE_NAME;
      resolvers.Mutation[updateName] = async (obj, { input }) => {
        const keys = t.PKEYS.split(',');
        let keys_found = true;
        keys.forEach((key, i) => {
          keys_found = keys_found && !!input[key]
        });

        if(keys_found){
          // primary key(s) found, update
          const sets = [];
          const update_params = [];
          const set_where = [];
          const where_params = [];
          const fields = [];
          const values = [];
          if(options.hooks.before_update){
            input = await options.hooks.before_update(t.TABLE_NAME, input, db);
            if(input === false){
              return null;
            }
          }
          for (var field in input) {
            fields.push(field);
            values.push(input[field]);
            if(keys.indexOf(field) > -1){
              // pkey
              set_where.push(`${field}=?`);
              where_params.push(input[field]);
            } else {
              sets.push(`${field}=?`);
              update_params.push(input[field]);
            }
          }
          await db.query(`UPDATE ${t.TABLE_NAME}
            SET ${sets.join(',')}
            WHERE ${set_where.join(' AND ')}
          `,update_params.concat(where_params));


          // return
          const where = keys.map(key => `${key}=?`).join(' AND ');
          const params = keys.map(key => input[key]);
          var [rows] = await db.query(`select * from ${t.TABLE_NAME} where ${where}`, params);

          if(options.hooks.after_update){
            await options.hooks.after_update(t.TABLE_NAME, input, db, rows[0]);
          }

          return rows[0];
        } else {
          // error, insuficient key definition (not all unique columns identified)
          console.log('Bad Update, not all keys provided');
          return null; // TODO: pass up as error
        }
      };
    });

    // FOREIGN KEY resolvers
    for (var t of relationships) {
      const { TABLE_NAME, LINKED_TABLE, TO_COL, FROM_COL } = t;
      if(resolvers[TABLE_NAME] === undefined){
        resolvers[TABLE_NAME] = {}
      }
      const sql = `SELECT * FROM
        ${LINKED_TABLE}
        WHERE ${TO_COL} = ?

      `;
      resolvers[TABLE_NAME][LINKED_TABLE] = async (parent, args) => {
        const [rows] = await db.query(sql,[parent[FROM_COL]]);
        return rows[0];
      }
    }

    // TODO: prevent endless recursive diving...

    // CHILD resolvers (reverse FK)
    for (var t of relationships) {
      const { TABLE_NAME, LINKED_TABLE, TO_COL, FROM_COL } = t;
      if(resolvers[LINKED_TABLE] === undefined){
        resolvers[LINKED_TABLE] = {}
      }
      const sql = `SELECT * FROM ${TABLE_NAME} WHERE ${FROM_COL} = ?`;
      resolvers[LINKED_TABLE][TABLE_NAME] = async (parent, args) => {
        const { limit, offset, where, order } = args;
        const { wheres, params } = where_args(where);
        const [rows] = await db.query(`${sql}
          ${where ? ' AND ' + wheres : ''}
          ${order ? ('order by ' + order.replace(/[;-]/g,'')) : ''}
          ${limit ? 'limit ' + parseInt(limit,10) : ''}
          ${offset ? 'offset ' + parseInt(offset,10) : ''}
        `,[parent[TO_COL]].concat(params));
        return rows;
      }
    }

    const schemaDef = makeExecutableSchema({
      // https://www.graphql-tools.com/docs/generate-schema
      typeDefs: inputs + types + queries + mutations,
      resolvers
    })
    return [schemaDef,root];
  }
}

module.exports = db;
