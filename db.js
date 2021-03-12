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

const is_set = value => typeof value !== 'undefined'

// allow restricting table/row access based on user token
// by defining a function that returns a WHERE fragment of SQL
// format: {
//  table_name: token => if(token.bad) return '1=0'
//
//  posts: token => return 'author_id=' + token.sub
// }
const access_resolver = (table, token, options) => {
  // console.log('access_resolver',table, token);
  // console.log('options.access_limit',options.access_limit);
  if(options && options.access_limit && options.access_limit[table]){
    return options.access_limit[table](token);
  }
  return null;
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
const where_args = (where, table, token, options) => {
  const wheres = [];
  const access_limit = access_resolver(table, token, options);
  if(access_limit){
    wheres.push(access_limit);
  }
  let params = [];
  let fields = '*';
  if(where){
    const json = JSON.parse(where);
    for (var field in json) {
      if (json.hasOwnProperty(field)) {
        const lcfield = field.toLowerCase();
        if(typeof json[field] === 'object'){
          if(['or','and'].indexOf(lcfield) > -1){ // { AND : [{ field1: 1}, { field2: "OK" } ]}
            const parts = json[field]; // array of objects
            const sub_where = [];
            for (var w of parts) {
              const r = where_args(JSON.stringify(w), table, token, options);
              sub_where.push(r.wheres);
              if(r.params.length > 0){
                params.push.apply(params, r.params)
              }
            }
            if(lcfield === 'and'){
              wheres.push('(' + sub_where.join(` AND `) + ')')
            } else {
              wheres.push('(' + sub_where.join(' OR ') + ')')
            }
          } else if(json[field] === null){ // { field: null }
            wheres.push(`\`${field}\` IS NULL`);
          } else if(json[field].eq){
            wheres.push(`\`${field}\` = ?`);
            params.push(json[field].eq)
          } else if(typeof json[field].neq !== 'undefined'){
            if(json[field].neq === null){ // { xxx : { neq: null }}
              wheres.push(`\`${field}\` IS NOT NULL`);
            } else {
              wheres.push(`\`${field}\` <> ?`);
              params.push(json[field].neq)
            }
          } else if(is_set(json[field].gt)){
            wheres.push(`\`${field}\` > ?`);
            params.push(json[field].gt)
          } else if(is_set(json[field].gte)){
            wheres.push(`\`${field}\` >= ?`);
            params.push(json[field].gte)
          } else if(is_set(json[field].lt)){
            wheres.push(`\`${field}\` < ?`);
            params.push(json[field].lt)
          } else if(is_set(json[field].lte)){
            wheres.push(`\`${field}\` <= ?`);
            params.push(json[field].lte)
          } else if(json[field].between){
            wheres.push(`\`${field}\` between ? AND ?`);
            params = params.concat(json[field].between)
          } else if(is_set(json[field].like)){
            wheres.push(`\`${field}\` like ?`);
            params.push(json[field].like)
          } else if(json[field].in){
            wheres.push(`\`${field}\` in (?)`);
            params.push(json[field].in)
          }
        } else {
          if(field === 'distinct'){ // { distinct: 'field'}
            fields = 'distinct ' + json[field]
          } else {
            wheres.push(`\`${field}\` = ?`);
            params.push(json[field]);
          }
        }
      }
    }
  }
  return {
    wheres:wheres.length > 0 ? wheres.join(' AND ') : '',
    params,
    fields
  };
}

const no_op = () => null

const db = {

  dlog: console.log,

  // store passed options in local var
  config: options => {
    config = {...config, ...options};
  },

  // connect to db if not yet connected
  init: async () => {
    if(typeof db.pool === 'undefined'){
      db.dlog('create pool')
      db.pool = await mysql.createPool(config);
    }
  },

  // pass SQL to db and return results
  query: async (...args) => {
    await db.init();
    const conn = db.pool.promise();
    db.dlog('query',{...args})
    return await conn.query(...args)
      .catch(db.dlog);
  },

  first: async (...args) => {
    const [rows] = await db.query(...args);
    return rows[0];
  },

  // manually disconnect
  quit: () => {
    db.pool.end();
  },

  /**
   * pull table/column data from database to construct GraphQL schema
   */
  get_schema: async (options) => {
    db.dlog('get_schema')
    db.config(options.connection);
    await db.init();
    const conn = db.pool.promise();
    const custom_types = options.custom_types || '';
    const custom_queries = options.custom_queries || '';
    const custom_mutations = options.custom_mutations || '';
    const custom_query_resolvers = options.custom_query_resolvers || no_op;
    const custom_mutation_resolvers = options.custom_mutation_resolvers || no_op;

    await conn.query('SET SESSION group_concat_max_len=900000');
    await conn.query('SET GLOBAL group_concat_max_len=900000');
    const [tables] = await conn.query(K.SQL_SCHEMA(config.database));
    const [relationships] = await conn.query(K.SQL_RELATIONSHIPS(config.database));
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
          var [rows] = await conn.query(`select
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
        // <query name>: (parent, args) => {...},
        // <query name>: (parent, args) => {...},
      },
      Mutation: {
        // <query name>: (parent, args) => {...},
      },
      // sub resolvers
      // <parent>: {
      //   <sub query>: parent => {...},
      //   <sub query>: parent => {...},
      // },
    };


    const root = {};
    const logger = db.dlog
    tables.forEach(t => {
      // 'get' resolver
      resolvers.Query[t.TABLE_NAME] = async (obj, args, req) => {
        // console.log('req.user',req.user);
        // console.log('resolving',t.TABLE_NAME);
        const { limit, offset, where, order } = args;
        const { wheres, params, fields } = where_args(where, t.TABLE_NAME, req.user, options);
        // console.log('sql',`select ${fields} from ${t.TABLE_NAME} ${wheres ? 'where ' + wheres : ''} ${order ? ('order by ' + order.replace(/[;-]/g,'')) : ''} ${limit ? 'limit ' + parseInt(limit,10) : ''} ${offset ? 'offset ' + parseInt(offset,10) : ''} `);
        var [rows] = await conn.query(`select ${fields} from ${t.TABLE_NAME}
          ${wheres ? 'where ' + wheres : ''}
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
        logger('mutation',createName, input)
        const columns = [];
        const values = [];
        // BEFORE INSERT
        if(options.hooks.before_insert){
          input = await options.hooks.before_insert(t.TABLE_NAME, input, db, resolvers).catch(db.dlog);
          if(input === false){
            return 0;
          }
        }
        for (var field in input) {
          columns.push(field);
          values.push(input[field]);
        }
        let id = await conn.query(`INSERT IGNORE INTO ${t.TABLE_NAME} (\`${columns.join('\`,\`')}\`) values (${columns.map(c => '?').join(',')})`,values)
          .then(r => r[0].insertId)
          .catch(db.dlog);

        if(options.hooks.after_insert){
          await options.hooks.after_insert(t.TABLE_NAME, { id, ...input }, db, resolvers).catch(db.dlog);
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
            const ok = await options.hooks.before_delete(t.TABLE_NAME, input, db, resolvers);
            if(ok === false){
              return "Delete refused by pre-delete check";
            }
          }
          if(options.hooks.after_delete){
            const model = await db.first(`select * from ${t.TABLE_NAME} where ${columns.join(' AND ')}`,values);
            const [res] = await conn.query(`DELETE FROM ${t.TABLE_NAME} WHERE ${columns.join(' AND ')}`,values);
            await options.hooks.after_delete(t.TABLE_NAME, model, db, resolvers);
            return `${res.affectedRows} row(s) deleted.`;
          } else {
            const [res] = await conn.query(`DELETE FROM ${t.TABLE_NAME} WHERE ${columns.join(' AND ')}`,values);
            return `${res.affectedRows} row(s) deleted.`;
          }
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
            input = await options.hooks.before_update(t.TABLE_NAME, input, db, resolvers);
            if(input === false){
              return null;
            }
          }
          for (var field in input) {
            fields.push(field);
            values.push(input[field]);
            if(keys.indexOf(field) > -1){
              // pkey
              set_where.push(`\`${field}\`=?`);
              where_params.push(input[field]);
            } else {
              sets.push(`\`${field}\`=?`);
              update_params.push(input[field]);
            }
          }
          await conn.query(`UPDATE ${t.TABLE_NAME}
            SET ${sets.join(',')}
            WHERE ${set_where.join(' AND ')}
          `,update_params.concat(where_params));

          // return
          const where = keys.map(key => `${key}=?`).join(' AND ');
          const params = keys.map(key => input[key]);
          var [rows] = await conn.query(`select * from ${t.TABLE_NAME} where ${where}`, params);

          if(options.hooks.after_update){
            await options.hooks.after_update(t.TABLE_NAME, input, db, rows[0], resolvers);
          }

          return rows[0];
        } else {
          // error, insuficient key definition (not all unique columns identified)
          logger('Bad Update, not all keys provided');
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
      resolvers[TABLE_NAME][`${FROM_COL}_${LINKED_TABLE}`] = async (parent, args, req) => {
        const { where } = args;
        const { wheres, params } = where_args(where, LINKED_TABLE, req.user, options);
        var [rows] = await conn.query(`${sql}
          ${wheres ? 'AND ' + wheres : ''}
          `, [parent[FROM_COL],...params]);
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
      // name collision
      // if(resolvers[LINKED_TABLE][TABLE_NAME]){
      //   // already exists...
      //
      // }
      // OPINIONATED: fk matches pk
      if(FROM_COL === TO_COL || TO_COL === 'id'){
        resolvers[LINKED_TABLE][TABLE_NAME] = async (parent, args, req) => {
          const { limit, offset, where, order } = args;
          const { wheres, params } = where_args(where, TABLE_NAME, req.user, options);
          const [rows] = await conn.query(`${sql}
            ${where ? ' AND ' + wheres : ''}
            ${order ? ('order by ' + order.replace(/[;-]/g,'')) : ''}
            ${limit ? 'limit ' + parseInt(limit,10) : ''}
            ${offset ? 'offset ' + parseInt(offset,10) : ''}
          `,[parent[TO_COL]].concat(params));
          return rows;
        }
      } else { // fk and pk names don't match
        // resolvers[LINKED_TABLE][`${TABLE_NAME}${FROM_COL}`] = async (parent, args) => {
        //   const { limit, offset, where, order } = args;
        //   const { wheres, params } = where_args(where);
        //   const [rows] = await conn.query(`${sql}
        //     ${where ? ' AND ' + wheres : ''}
        //     ${order ? ('order by ' + order.replace(/[;-]/g,'')) : ''}
        //     ${limit ? 'limit ' + parseInt(limit,10) : ''}
        //     ${offset ? 'offset ' + parseInt(offset,10) : ''}
        //   `,[parent[TO_COL]].concat(params));
        //   return rows;
        // }
      }

    }

    // add custom resolvers after to allow overrides
    if(options.custom_query_resolvers){
      resolvers.Query = {
        ...resolvers.Query,
        // <query name>: async (parent, args) => {...},
        ...options.custom_query_resolvers(db)
      }
    }
    if(options.custom_mutation_resolvers){
      resolvers.Mutation = {
        ...resolvers.Mutation,
        // <query name>: async (parent, args) => {...},
        ...options.custom_mutation_resolvers(db)
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
