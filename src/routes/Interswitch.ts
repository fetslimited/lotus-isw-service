import { Router } from 'express';
import { triggerKeyExchange, triggerEcho, getSocketStatus } from '../controller/Http/KeyExchangeController';
import {
    getPoolStatus,
    rebuildPool,
    addTerminal,
    removeTerminal,
} from '../controller/Http/TerminalPoolController';

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

/**
 * Terminal Pool management
 * GET    /api/interswitch/terminal-pool/status   — view pool contents + pointer
 * POST   /api/interswitch/terminal-pool/rebuild  — reload Redis from MongoDB
 * POST   /api/interswitch/terminal-pool          — add a TID  { tid: string }
 * DELETE /api/interswitch/terminal-pool/:tid     — remove a TID
 */
router.get('/terminal-pool/status', getPoolStatus);
router.post('/terminal-pool/rebuild', rebuildPool);
router.post('/terminal-pool', addTerminal);
router.delete('/terminal-pool/:tid', removeTerminal);

export default router;
