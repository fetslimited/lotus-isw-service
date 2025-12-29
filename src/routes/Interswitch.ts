import { Router } from 'express';
import { triggerKeyExchange, triggerEcho, getSocketStatus } from '../controller/Http/KeyExchangeController';

const router = Router();

/**
 * Trigger key exchange with Interswitch
 * POST /api/interswitch/key-exchange
 */
router.post('/key-exchange', triggerKeyExchange);

/**
 * Trigger echo request to Interswitch
 * POST /api/interswitch/echo
 */
router.post('/echo', triggerEcho);

/**
 * Get socket server status
 * GET /api/interswitch/status
 */
router.get('/status', getSocketStatus);

export default router;
