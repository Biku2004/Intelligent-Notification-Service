"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTraceId = exports.tracingMiddleware = exports.TRACE_HEADER = exports.traceContext = void 0;
const uuid_1 = require("uuid");
const async_hooks_1 = require("async_hooks");
// AsyncLocalStorage to store context (traceId) across async calls
exports.traceContext = new async_hooks_1.AsyncLocalStorage();
exports.TRACE_HEADER = 'x-correlation-id';
const tracingMiddleware = (req, res, next) => {
    // Get existing trace ID from header or generate new one
    const traceId = req.headers[exports.TRACE_HEADER] || (0, uuid_1.v4)();
    // Set header on response so client knows the ID
    res.setHeader(exports.TRACE_HEADER, traceId);
    // Run next middleware within the context of this traceId
    exports.traceContext.run({ traceId }, () => {
        next();
    });
};
exports.tracingMiddleware = tracingMiddleware;
const getTraceId = () => {
    return exports.traceContext.getStore()?.traceId;
};
exports.getTraceId = getTraceId;
