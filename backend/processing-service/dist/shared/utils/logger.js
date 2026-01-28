"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
const tracing_1 = require("../middleware/tracing");
const formatMessage = (level, message, data) => {
    const traceId = (0, tracing_1.getTraceId)();
    const timestamp = new Date().toISOString();
    const tracePart = traceId ? ` [TraceID: ${traceId}]` : '';
    const dataPart = data ? ` ${JSON.stringify(data)}` : '';
    return `[${timestamp}] ${level}${tracePart}: ${message}${dataPart}`;
};
exports.Logger = {
    info: (message, data) => {
        console.log(formatMessage('INFO', message, data));
    },
    error: (message, error) => {
        console.error(formatMessage('ERROR', message, error));
    },
    warn: (message, data) => {
        console.warn(formatMessage('WARN', message, data));
    },
    debug: (message, data) => {
        console.debug(formatMessage('DEBUG', message, data));
    }
};
