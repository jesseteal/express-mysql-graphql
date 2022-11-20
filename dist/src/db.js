"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generate_schema = exports.first = exports.select = exports.query = void 0;
var schema_1 = require("@graphql-tools/schema");
var graphql_scalars_1 = require("graphql-scalars");
var constants_1 = require("./constants");
var mysql = require("mysql2");
var pool = null;
var connection_config = { connectionLimit: 10 };
var is_set = function (value) { return typeof value !== "undefined"; };
// export const add_logger = (_logger: any) => {
//   if (_logger) {
//     logger = _logger;
//   }
// };
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
var where_args = function (where, table, token, options) {
    var _a, _b, _c;
    var wheres = [];
    var access_limit = (_c = (_b = (_a = options.rules) === null || _a === void 0 ? void 0 : _a[table]) === null || _b === void 0 ? void 0 : _b.restrict) === null || _c === void 0 ? void 0 : _c.call(_b, token);
    if (access_limit) {
        wheres.push(access_limit);
    }
    var params = [];
    var fields = "*";
    if (where) {
        var json = JSON.parse(where);
        for (var field in json) {
            if (json.hasOwnProperty(field)) {
                var lcfield = field.toLowerCase();
                if (typeof json[field] === "object") {
                    if (["or", "and"].indexOf(lcfield) > -1) {
                        // { AND : [{ field1: 1}, { field2: "OK" } ]}
                        var parts = json[field]; // array of objects
                        var sub_where = [];
                        for (var _i = 0, parts_1 = parts; _i < parts_1.length; _i++) {
                            var w = parts_1[_i];
                            var r = where_args(JSON.stringify(w), table, token, options);
                            sub_where.push(r.wheres);
                            if (r.params.length > 0) {
                                params.push.apply(params, r.params);
                            }
                        }
                        if (lcfield === "and") {
                            wheres.push("(" + sub_where.join(" AND ") + ")");
                        }
                        else {
                            wheres.push("(" + sub_where.join(" OR ") + ")");
                        }
                    }
                    else if (json[field] === null) {
                        // { field: null }
                        wheres.push("`".concat(field, "` IS NULL"));
                    }
                    else if (json[field].eq) {
                        wheres.push("`".concat(field, "` = ?"));
                        params.push(json[field].eq);
                    }
                    else if (typeof json[field].neq !== "undefined") {
                        if (json[field].neq === null) {
                            // { xxx : { neq: null }}
                            wheres.push("`".concat(field, "` IS NOT NULL"));
                        }
                        else {
                            wheres.push("`".concat(field, "` <> ?"));
                            params.push(json[field].neq);
                        }
                    }
                    else if (is_set(json[field].gt)) {
                        wheres.push("`".concat(field, "` > ?"));
                        params.push(json[field].gt);
                    }
                    else if (is_set(json[field].gte)) {
                        wheres.push("`".concat(field, "` >= ?"));
                        params.push(json[field].gte);
                    }
                    else if (is_set(json[field].lt)) {
                        wheres.push("`".concat(field, "` < ?"));
                        params.push(json[field].lt);
                    }
                    else if (is_set(json[field].lte)) {
                        wheres.push("`".concat(field, "` <= ?"));
                        params.push(json[field].lte);
                    }
                    else if (json[field].between) {
                        wheres.push("`".concat(field, "` between ? AND ?"));
                        params = params.concat(json[field].between);
                    }
                    else if (is_set(json[field].like)) {
                        wheres.push("`".concat(field, "` like ?"));
                        params.push(json[field].like);
                    }
                    else if (json[field].in) {
                        wheres.push("`".concat(field, "` in (?)"));
                        params.push(json[field].in);
                    }
                }
                else {
                    if (field === "distinct") {
                        // { distinct: 'field'}
                        fields = "distinct " + json[field];
                    }
                    else {
                        wheres.push("`".concat(field, "` = ?"));
                        params.push(json[field]);
                    }
                }
            }
        }
    }
    return {
        wheres: wheres.length > 0 ? wheres.join(" AND ") : "",
        params: params,
        fields: fields,
    };
};
var cacheDbConnection = function (options) {
    connection_config = __assign(__assign({}, connection_config), options);
};
var init_pool = function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!!pool) return [3 /*break*/, 2];
                return [4 /*yield*/, mysql.createPool(connection_config)];
            case 1:
                // logger("[mysgql]: create pool");
                pool = _a.sent();
                _a.label = 2;
            case 2: return [2 /*return*/];
        }
    });
}); };
var connect = function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, init_pool()];
            case 1:
                _a.sent();
                return [2 /*return*/, pool.promise()];
        }
    });
}); };
var query = function () {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        args[_i] = arguments[_i];
    }
    return __awaiter(void 0, void 0, void 0, function () {
        var conn;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, connect()];
                case 1:
                    conn = _a.sent();
                    return [4 /*yield*/, conn.query.apply(conn, args).catch(db.dlog)];
                case 2: 
                // logger("[mysgql]: query", { ...args });
                return [2 /*return*/, _a.sent()];
            }
        });
    });
};
exports.query = query;
var select = function () {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        args[_i] = arguments[_i];
    }
    return __awaiter(void 0, void 0, void 0, function () {
        var conn, rows;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, connect()];
                case 1:
                    conn = _a.sent();
                    return [4 /*yield*/, conn.query.apply(conn, args).catch(db.dlog)];
                case 2:
                    rows = (_a.sent())[0];
                    return [2 /*return*/, rows];
            }
        });
    });
};
exports.select = select;
var first = function () {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        args[_i] = arguments[_i];
    }
    return __awaiter(void 0, void 0, void 0, function () {
        var rows;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, exports.query.apply(void 0, args)];
                case 1:
                    rows = (_a.sent())[0];
                    return [2 /*return*/, rows[0]];
            }
        });
    });
};
exports.first = first;
var db = {
    first: exports.first,
    query: exports.query,
    select: exports.select,
    // manually disconnect
    quit: function () { return pool.end(); },
};
var generate_schema = function (options) { return __awaiter(void 0, void 0, void 0, function () {
    var conn, custom_types, custom_queries, custom_mutations, tables, relationships, inputs, types, queries, mutations, resolvers, _loop_1, _i, relationships_1, t, _loop_2, _a, relationships_2, t, custom_resolvers_obj, _b, _c, key;
    var _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                // cache connection data
                cacheDbConnection(options.connection);
                return [4 /*yield*/, connect()];
            case 1:
                conn = _e.sent();
                custom_types = options.custom_types || "";
                custom_queries = options.custom_queries || "";
                custom_mutations = options.custom_mutations || "";
                return [4 /*yield*/, conn.query("SET SESSION group_concat_max_len=900000")];
            case 2:
                _e.sent();
                return [4 /*yield*/, conn.query("SET GLOBAL group_concat_max_len=900000")];
            case 3:
                _e.sent();
                return [4 /*yield*/, conn.query(constants_1.default.SQL_SCHEMA(connection_config.database))];
            case 4:
                tables = (_e.sent())[0];
                return [4 /*yield*/, conn.query(constants_1.default.SQL_RELATIONSHIPS(connection_config.database))];
            case 5:
                relationships = (_e.sent())[0];
                inputs = tables
                    .map(function (r) {
                    var _a, _b;
                    if ((_a = options.custom_merged_inputs) === null || _a === void 0 ? void 0 : _a[r.TABLE_NAME]) {
                        return r.inputs
                            .replace("}", "")
                            .concat((_b = options.custom_merged_inputs) === null || _b === void 0 ? void 0 : _b[r.TABLE_NAME], "\n}");
                    }
                    return r.inputs;
                })
                    .join("\n");
                types = tables
                    .map(function (r) {
                    var _a, _b;
                    if ((_a = options.custom_merged_types) === null || _a === void 0 ? void 0 : _a[r.TABLE_NAME]) {
                        return r.types
                            .replace("}", "")
                            .concat((_b = options.custom_merged_types) === null || _b === void 0 ? void 0 : _b[r.TABLE_NAME], "\n}");
                    }
                    return r.types;
                })
                    .join("\n") +
                    "\n      scalar Date\n      scalar DateTime\n      type schema {\n        column:  String\n        type:  String\n        required: Int\n      }\n      ".concat(custom_types, "\n    ");
                queries = "\n    type Query {\n        schema(table: String!): [schema]\n        ".concat(custom_queries, "\n    ") +
                    tables
                        .map(function (t) {
                        return "".concat(t.TABLE_NAME, "(limit: Int, offset: Int, where: String, order: String): [").concat(t.TABLE_NAME, "]");
                    })
                        .join("\n") +
                    "\n  }";
                mutations = "\n    type Mutation {\n        ".concat(custom_mutations, "\n    ") +
                    tables
                        .map(function (t) { return "\n        create".concat(t.TABLE_NAME, "(input: ").concat(t.TABLE_NAME, "Input): Int\n        update").concat(t.TABLE_NAME, "(input: ").concat(t.TABLE_NAME, "Input): ").concat(t.TABLE_NAME, "\n        delete").concat(t.TABLE_NAME, "(input: ").concat(t.TABLE_NAME, "Input): String\n      "); })
                        .join("\n") +
                    "\n  } ";
                resolvers = {
                    // https://github.com/Urigo/graphql-scalars
                    Date: graphql_scalars_1.DateResolver,
                    DateTime: graphql_scalars_1.DateTimeResolver,
                    // https://www.graphql-tools.com/docs/generate-schema
                    Query: {
                        // allow client to query schema data for Front-End activities
                        schema: function (obj, args) { return __awaiter(void 0, void 0, void 0, function () {
                            var table, type, rows;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        if (!options.enable_schema_query) {
                                            return [2 /*return*/, null];
                                        }
                                        table = args.table, type = args.type;
                                        return [4 /*yield*/, conn.query("select\n              COLUMN_NAME as `column`\n              ,case WHEN IS_NULLABLE = 'NO' AND COLUMN_KEY <> 'PRI' then 1 else 0 end as required\n              ,case when DATA_TYPE IN ('bigint','int','tinyint') then 'int'\n              WHEN DATA_TYPE IN ('double','float','decimal') then 'decimal'\n              when DATA_TYPE in ('date','datetime') then DATA_TYPE\n              else 'string' end as `type`\n            FROM INFORMATION_SCHEMA.COLUMNS c\n            where TABLE_SCHEMA='".concat(connection_config.database, "'\n              and TABLE_NAME='").concat(table, "'\n            order by ORDINAL_POSITION"))];
                                    case 1:
                                        rows = (_a.sent())[0];
                                        return [2 /*return*/, rows];
                                }
                            });
                        }); },
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
                tables.forEach(function (t) {
                    resolvers.Query[t.TABLE_NAME] = function (obj, args, _a) {
                        var req = _a.req;
                        return __awaiter(void 0, void 0, void 0, function () {
                            var limit, offset, where, order, _b, wheres, params, fields, rows;
                            return __generator(this, function (_c) {
                                switch (_c.label) {
                                    case 0:
                                        limit = args.limit, offset = args.offset, where = args.where, order = args.order;
                                        _b = where_args(where, t.TABLE_NAME, req === null || req === void 0 ? void 0 : req.auth, options), wheres = _b.wheres, params = _b.params, fields = _b.fields;
                                        return [4 /*yield*/, conn.query("select ".concat(fields, " from ").concat(t.TABLE_NAME, "\n          ").concat(wheres ? "where " + wheres : "", "\n          ").concat(order ? "order by " + order.replace(/[;-]/g, "") : "", "\n          ").concat(limit ? "limit ".concat(Number(limit)) : "", "\n          ").concat(offset ? "offset ".concat(Number(offset)) : "", "\n          "), params)];
                                    case 1:
                                        rows = (_c.sent())[0];
                                        return [2 /*return*/, rows];
                                }
                            });
                        });
                    };
                    // 'create' resolver
                    var createName = "create" + t.TABLE_NAME;
                    resolvers.Mutation[createName] = function (obj, args) { return __awaiter(void 0, void 0, void 0, function () {
                        var input, columns, values, field, id, keys, where, params, rows;
                        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
                        return __generator(this, function (_l) {
                            switch (_l.label) {
                                case 0:
                                    input = args.input;
                                    columns = [];
                                    values = [];
                                    if (!((_b = (_a = options.rules) === null || _a === void 0 ? void 0 : _a[t.TABLE_NAME]) === null || _b === void 0 ? void 0 : _b.before_insert)) return [3 /*break*/, 2];
                                    return [4 /*yield*/, ((_e = (_d = (_c = options.rules) === null || _c === void 0 ? void 0 : _c[t.TABLE_NAME]) === null || _d === void 0 ? void 0 : _d.before_insert) === null || _e === void 0 ? void 0 : _e.call(_d, {
                                            model: input,
                                            db: db,
                                        }))];
                                case 1:
                                    input = _l.sent();
                                    if (input === false) {
                                        return [2 /*return*/, 0]; // no insertId available
                                    }
                                    _l.label = 2;
                                case 2:
                                    for (field in input) {
                                        columns.push(field);
                                        values.push(input[field]);
                                    }
                                    return [4 /*yield*/, conn
                                            .query("INSERT IGNORE INTO ".concat(t.TABLE_NAME, " (`").concat(columns.join("`,`"), "`) values (").concat(columns.map(function (c) { return "?"; }).join(","), ")"), values)
                                            .then(function (r) { return r[0].insertId; })
                                            .catch(db.dlog)];
                                case 3:
                                    id = _l.sent();
                                    if (!((_g = (_f = options.rules) === null || _f === void 0 ? void 0 : _f[t.TABLE_NAME]) === null || _g === void 0 ? void 0 : _g.after_insert)) return [3 /*break*/, 6];
                                    keys = t.PKEYS.split(",");
                                    where = keys.map(function (key) { return "".concat(key, "=?"); }).join(" AND ");
                                    params = keys.map(function (key) { return input[key]; });
                                    return [4 /*yield*/, conn.query("select * from ".concat(t.TABLE_NAME, " where ").concat(where), params)];
                                case 4:
                                    rows = (_l.sent())[0];
                                    return [4 /*yield*/, ((_k = (_j = (_h = options.rules) === null || _h === void 0 ? void 0 : _h[t.TABLE_NAME]) === null || _j === void 0 ? void 0 : _j.after_insert) === null || _k === void 0 ? void 0 : _k.call(_j, {
                                            model: __assign({ id: id }, input),
                                            db: db,
                                            row: rows[0],
                                        }))];
                                case 5:
                                    _l.sent();
                                    _l.label = 6;
                                case 6: return [2 /*return*/, id];
                            }
                        });
                    }); };
                    // delete resolver
                    var deleteName = "delete" + t.TABLE_NAME;
                    resolvers.Mutation[deleteName] = function (obj, _a) {
                        var input = _a.input;
                        return __awaiter(void 0, void 0, void 0, function () {
                            var keys, columns, values, all_keys_found, ok, model, res, res;
                            var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
                            return __generator(this, function (_m) {
                                switch (_m.label) {
                                    case 0:
                                        keys = t.PKEYS.split(",");
                                        columns = [];
                                        values = [];
                                        all_keys_found = true;
                                        keys.forEach(function (key, i) {
                                            all_keys_found = all_keys_found && !!input[key];
                                            columns.push("".concat(key, "=?"));
                                            values.push(input[key]);
                                        });
                                        if (!all_keys_found) return [3 /*break*/, 8];
                                        if (!((_c = (_b = options.rules) === null || _b === void 0 ? void 0 : _b[t.TABLE_NAME]) === null || _c === void 0 ? void 0 : _c.before_delete)) return [3 /*break*/, 2];
                                        return [4 /*yield*/, ((_f = (_e = (_d = options.rules) === null || _d === void 0 ? void 0 : _d[t.TABLE_NAME]) === null || _e === void 0 ? void 0 : _e.before_delete) === null || _f === void 0 ? void 0 : _f.call(_e, {
                                                model: input,
                                                db: db,
                                            }))];
                                    case 1:
                                        ok = _m.sent();
                                        if (ok === false) {
                                            return [2 /*return*/, "Delete refused by pre-delete check"];
                                        }
                                        _m.label = 2;
                                    case 2:
                                        if (!((_h = (_g = options.rules) === null || _g === void 0 ? void 0 : _g[t.TABLE_NAME]) === null || _h === void 0 ? void 0 : _h.after_delete)) return [3 /*break*/, 6];
                                        return [4 /*yield*/, db.first("select * from ".concat(t.TABLE_NAME, " where ").concat(columns.join(" AND ")), values)];
                                    case 3:
                                        model = _m.sent();
                                        return [4 /*yield*/, conn.query("DELETE FROM ".concat(t.TABLE_NAME, " WHERE ").concat(columns.join(" AND ")), values)];
                                    case 4:
                                        res = (_m.sent())[0];
                                        return [4 /*yield*/, ((_l = (_k = (_j = options.rules) === null || _j === void 0 ? void 0 : _j[t.TABLE_NAME]) === null || _k === void 0 ? void 0 : _k.after_delete) === null || _l === void 0 ? void 0 : _l.call(_k, {
                                                model: model,
                                                db: db,
                                            }))];
                                    case 5:
                                        _m.sent();
                                        return [2 /*return*/, "".concat(res.affectedRows, " row(s) deleted.")];
                                    case 6: return [4 /*yield*/, conn.query("DELETE FROM ".concat(t.TABLE_NAME, " WHERE ").concat(columns.join(" AND ")), values)];
                                    case 7:
                                        res = (_m.sent())[0];
                                        return [2 /*return*/, "".concat(res.affectedRows, " row(s) deleted.")];
                                    case 8: return [2 /*return*/, "Delete Failed - missing primary keys"];
                                }
                            });
                        });
                    };
                    // 'update' resolver
                    var updateName = "update" + t.TABLE_NAME;
                    resolvers.Mutation[updateName] = function (obj, _a) {
                        var input = _a.input;
                        return __awaiter(void 0, void 0, void 0, function () {
                            var keys, keys_found, sets, update_params, set_where, where_params, fields, values, where_1, params_1, rows, field, where, params, rows;
                            var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
                            return __generator(this, function (_m) {
                                switch (_m.label) {
                                    case 0:
                                        keys = t.PKEYS.split(",");
                                        keys_found = true;
                                        keys.forEach(function (key, i) {
                                            keys_found = keys_found && !!input[key];
                                        });
                                        if (!keys_found) return [3 /*break*/, 8];
                                        sets = [];
                                        update_params = [];
                                        set_where = [];
                                        where_params = [];
                                        fields = [];
                                        values = [];
                                        if (!((_c = (_b = options.rules) === null || _b === void 0 ? void 0 : _b[t.TABLE_NAME]) === null || _c === void 0 ? void 0 : _c.before_update)) return [3 /*break*/, 3];
                                        where_1 = keys.map(function (key) { return "".concat(key, "=?"); }).join(" AND ");
                                        params_1 = keys.map(function (key) { return input[key]; });
                                        return [4 /*yield*/, conn.query("select * from ".concat(t.TABLE_NAME, " where ").concat(where_1), params_1)];
                                    case 1:
                                        rows = (_m.sent())[0];
                                        return [4 /*yield*/, ((_f = (_e = (_d = options.rules) === null || _d === void 0 ? void 0 : _d[t.TABLE_NAME]) === null || _e === void 0 ? void 0 : _e.before_update) === null || _f === void 0 ? void 0 : _f.call(_e, {
                                                model: input,
                                                db: db,
                                                row: rows[0],
                                            }))];
                                    case 2:
                                        input = _m.sent();
                                        if (input === false) {
                                            return [2 /*return*/, null];
                                        }
                                        _m.label = 3;
                                    case 3:
                                        for (field in input) {
                                            fields.push(field);
                                            values.push(input[field]);
                                            if (keys.indexOf(field) > -1) {
                                                // pkey
                                                set_where.push("`".concat(field, "`=?"));
                                                where_params.push(input[field]);
                                            }
                                            else {
                                                sets.push("`".concat(field, "`=?"));
                                                update_params.push(input[field]);
                                            }
                                        }
                                        return [4 /*yield*/, conn.query("UPDATE ".concat(t.TABLE_NAME, "\n            SET ").concat(sets.join(","), "\n            WHERE ").concat(set_where.join(" AND "), "\n          "), update_params.concat(where_params))];
                                    case 4:
                                        _m.sent();
                                        where = keys.map(function (key) { return "".concat(key, "=?"); }).join(" AND ");
                                        params = keys.map(function (key) { return input[key]; });
                                        return [4 /*yield*/, conn.query("select * from ".concat(t.TABLE_NAME, " where ").concat(where), params)];
                                    case 5:
                                        rows = (_m.sent())[0];
                                        if (!((_h = (_g = options.rules) === null || _g === void 0 ? void 0 : _g[t.TABLE_NAME]) === null || _h === void 0 ? void 0 : _h.after_update)) return [3 /*break*/, 7];
                                        return [4 /*yield*/, ((_l = (_k = (_j = options.rules) === null || _j === void 0 ? void 0 : _j[t.TABLE_NAME]) === null || _k === void 0 ? void 0 : _k.after_update) === null || _l === void 0 ? void 0 : _l.call(_k, {
                                                model: input,
                                                db: db,
                                                row: rows[0],
                                            }))];
                                    case 6:
                                        _m.sent();
                                        _m.label = 7;
                                    case 7: return [2 /*return*/, rows[0]];
                                    case 8: 
                                    // error, insuficient key definition (not all unique columns identified)
                                    // logger("[mysgql]: Bad Update, not all keys provided");
                                    return [2 /*return*/, null]; // TODO: pass up as error
                                }
                            });
                        });
                    };
                });
                _loop_1 = function () {
                    var TABLE_NAME = t.TABLE_NAME, LINKED_TABLE = t.LINKED_TABLE, TO_COL = t.TO_COL, FROM_COL = t.FROM_COL;
                    if (resolvers[TABLE_NAME] === undefined) {
                        resolvers[TABLE_NAME] = {};
                    }
                    var sql = "SELECT * FROM\n        ".concat(LINKED_TABLE, "\n        WHERE ").concat(TO_COL, " = ?\n      ");
                    resolvers[TABLE_NAME]["".concat(FROM_COL, "_").concat(LINKED_TABLE)] = function (parent, args, req) { return __awaiter(void 0, void 0, void 0, function () {
                        var where, _a, wheres, params, rows;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    where = args.where;
                                    _a = where_args(where, LINKED_TABLE, req.user, options), wheres = _a.wheres, params = _a.params;
                                    return [4 /*yield*/, conn.query("".concat(sql, "\n          ").concat(wheres ? "AND " + wheres : "", "\n          "), __spreadArray([parent[FROM_COL]], params, true))];
                                case 1:
                                    rows = (_b.sent())[0];
                                    return [2 /*return*/, rows[0]];
                            }
                        });
                    }); };
                };
                // FOREIGN KEY resolvers
                for (_i = 0, relationships_1 = relationships; _i < relationships_1.length; _i++) {
                    t = relationships_1[_i];
                    _loop_1();
                }
                _loop_2 = function () {
                    var TABLE_NAME = t.TABLE_NAME, LINKED_TABLE = t.LINKED_TABLE, TO_COL = t.TO_COL, FROM_COL = t.FROM_COL;
                    if (resolvers[LINKED_TABLE] === undefined) {
                        resolvers[LINKED_TABLE] = {};
                    }
                    var sql = "SELECT * FROM ".concat(TABLE_NAME, " WHERE ").concat(FROM_COL, " = ?");
                    // name collision
                    // if(resolvers[LINKED_TABLE][TABLE_NAME]){
                    //   // already exists...
                    //
                    // }
                    // OPINIONATED: fk matches pk
                    if (FROM_COL === TO_COL || TO_COL === "id") {
                        resolvers[LINKED_TABLE][TABLE_NAME] = function (parent, args, req) { return __awaiter(void 0, void 0, void 0, function () {
                            var limit, offset, where, order, _a, wheres, params, rows;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        limit = args.limit, offset = args.offset, where = args.where, order = args.order;
                                        _a = where_args(where, TABLE_NAME, req.user, options), wheres = _a.wheres, params = _a.params;
                                        return [4 /*yield*/, conn.query("".concat(sql, "\n            ").concat(where ? " AND " + wheres : "", "\n            ").concat(order ? "order by " + order.replace(/[;-]/g, "") : "", "\n            ").concat(limit ? "limit " + parseInt(limit, 10) : "", "\n            ").concat(offset ? "offset " + parseInt(offset, 10) : "", "\n          "), [parent[TO_COL]].concat(params))];
                                    case 1:
                                        rows = (_b.sent())[0];
                                        return [2 /*return*/, rows];
                                }
                            });
                        }); };
                    }
                    else {
                        // fk and pk names don't match
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
                };
                // TODO: prevent endless recursive diving...
                // CHILD resolvers (reverse FK)
                for (_a = 0, relationships_2 = relationships; _a < relationships_2.length; _a++) {
                    t = relationships_2[_a];
                    _loop_2();
                }
                custom_resolvers_obj = (_d = options.custom_resolvers) === null || _d === void 0 ? void 0 : _d.call(options, db);
                if (custom_resolvers_obj) {
                    for (_b = 0, _c = Object.keys(custom_resolvers_obj); _b < _c.length; _b++) {
                        key = _c[_b];
                        if (resolvers[key]) {
                            resolvers[key] = __assign(__assign({}, resolvers[key]), custom_resolvers_obj[key]);
                        }
                        else {
                            resolvers[key] = custom_resolvers_obj[key];
                        }
                    }
                }
                // add custom resolvers after to allow overrides
                if (options.custom_query_resolvers) {
                    resolvers.Query = __assign(__assign({}, resolvers.Query), options.custom_query_resolvers(db));
                }
                if (options.custom_mutation_resolvers) {
                    resolvers.Mutation = __assign(__assign({}, resolvers.Mutation), options.custom_mutation_resolvers(db));
                }
                // if (options.custom_resolvers) {
                //   resolvers = {
                //     ...resolvers,
                //     ...options.custom_resolvers(db),
                //   };
                // }
                return [2 /*return*/, (0, schema_1.makeExecutableSchema)({
                        // https://www.graphql-tools.com/docs/generate-schema
                        // typeDefs: inputs + types + "\ntype Query { fake: Date }\n",
                        typeDefs: inputs + types + queries + mutations,
                        resolvers: resolvers,
                    })];
        }
    });
}); };
exports.generate_schema = generate_schema;
exports.default = db;
