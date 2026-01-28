
import { getTraceId } from '../middleware/tracing';

const formatMessage = (level: string, message: string, data?: any) => {
    const traceId = getTraceId();
    const timestamp = new Date().toISOString();
    const tracePart = traceId ? ` [TraceID: ${traceId}]` : '';
    const dataPart = data ? ` ${JSON.stringify(data)}` : '';

    return `[${timestamp}] ${level}${tracePart}: ${message}${dataPart}`;
};

export const Logger = {
    info: (message: string, data?: any) => {
        console.log(formatMessage('INFO', message, data));
    },
    error: (message: string, error?: any) => {
        console.error(formatMessage('ERROR', message, error));
    },
    warn: (message: string, data?: any) => {
        console.warn(formatMessage('WARN', message, data));
    },
    debug: (message: string, data?: any) => {
        console.debug(formatMessage('DEBUG', message, data));
    }
};
