"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var constants_1 = require("./constants");
describe("constants", function () {
    test("should generate sql schema string", function () {
        expect(constants_1.default.SQL_SCHEMA("test")).toBeTruthy();
    });
});
