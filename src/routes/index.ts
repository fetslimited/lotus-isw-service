import { Router } from 'express';
import InterswitchRouter from './Interswitch';

// Init router and path
const router = Router();

// Add sub-routes
router.use('/interswitch', InterswitchRouter);

// Export the base-router
export default router;
