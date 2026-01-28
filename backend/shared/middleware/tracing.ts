
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AsyncLocalStorage } from 'async_hooks';

// AsyncLocalStorage to store context (traceId) across async calls
export const traceContext = new AsyncLocalStorage<{ traceId: string }>();

export const TRACE_HEADER = 'x-correlation-id';

export const tracingMiddleware = (req: Request, res: Response, next: NextFunction) => {
    // Get existing trace ID from header or generate new one
    const traceId = (req.headers[TRACE_HEADER] as string) || uuidv4();

    // Set header on response so client knows the ID
    res.setHeader(TRACE_HEADER, traceId);

    // Run next middleware within the context of this traceId
    traceContext.run({ traceId }, () => {
        next();
    });
};

export const getTraceId = (): string | undefined => {
    return traceContext.getStore()?.traceId;
};
