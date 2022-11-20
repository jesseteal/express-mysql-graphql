"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
var sql_1 = require("./sql");
var custom_types = "\n    type BasicChartData {\n      total: Float\n      agg1: Float\n      agg2: Float\n    }\n";
var custom_queries = "\n    aggWinningContractRules(limit: Int): BasicChartData\n    aggWinningSpotRules(limit: Int): BasicChartData\n";
// const cleanSql = (sql: string) =>
//   sql
//     .replace('delete', '')
//     .replace('drop', '')
//     .replace('alter', '')
//     .replace(';', '');
var custom_query_resolvers = function (db) { return ({
    aggWinningContractRules: function (parent, _a) {
        var limit = _a.limit;
        return __awaiter(void 0, void 0, void 0, function () {
            var strLimit;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        strLimit = limit ? "limit ".concat(limit) : '';
                        return [4 /*yield*/, db.first((0, sql_1.WINNING_CONTRACT_AGGREGATION)(strLimit))];
                    case 1: return [2 /*return*/, _b.sent()];
                }
            });
        });
    },
    aggWinningSpotRules: function (parent, _a) {
        var limit = _a.limit;
        return __awaiter(void 0, void 0, void 0, function () {
            var strLimit;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        strLimit = limit ? "limit ".concat(limit) : '';
                        return [4 /*yield*/, db.first((0, sql_1.WINNING_SPOT_BID_AGGREGATION)(strLimit))];
                    case 1: return [2 /*return*/, _b.sent()];
                }
            });
        });
    },
}); };
var custom_resolvers = function (db) { return ({
    shipment: {
        possible_response: function (parent, args) { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!parent.isSpotOffer) return [3 /*break*/, 2];
                        return [4 /*yield*/, db.select(sql_1.SPOT_SHIPMENT_POSSIBLE_RESPONSES, [
                                parent.id || 0,
                            ])];
                    case 1: return [2 /*return*/, _a.sent()];
                    case 2: return [4 /*yield*/, db.select(sql_1.CONTRACT_SHIPMENT_POSSIBLE_RESPONSES, [
                            parent.id || 0,
                        ])];
                    case 3: return [2 /*return*/, _a.sent()];
                }
            });
        }); },
        from: function (parent, args) { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db.first("select * from stop where shipmentId=? and stopType='PU'", [parent.id])];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        }); },
        to: function (parent, args) { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db.first("select * from stop where shipmentId=? and stopType='Del'", [parent.id])];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        }); },
    },
}); };
var custom_merged_types = {
    // include enabled flag from rule_* for use in auditing
    response: "\n    enabled: Int\n  ",
    shipment: "\n    possible_response: [response]\n    from: stop\n    to: stop\n    ",
};
var custom_merged_inputs = {
    user: "\n    password: String\n  ",
};
var custom = {
    custom_merged_inputs: custom_merged_inputs,
    custom_merged_types: custom_merged_types,
    custom_types: custom_types,
    custom_queries: custom_queries,
    custom_query_resolvers: custom_query_resolvers,
    custom_resolvers: custom_resolvers,
};
exports.default = custom;
