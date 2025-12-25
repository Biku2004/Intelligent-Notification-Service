import { Router } from 'express';
import { triggerEvent } from '../controller/eventController';

const router = Router();

router.post('/trigger', triggerEvent);

export default router;