import { Router } from 'express';
import {
  register,
  login,
  getUser,
  updateUser,
  deleteUser,
  getAllUsers
} from '../controllers/user.controller';
import { validateToken } from '../middleware/validateTokenHandler';
import { checkRole } from '../middleware/roleMiddleware';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/', validateToken, getAllUsers);
router.get('/:id', validateToken, getUser);
router.put('/:id', validateToken, checkRole, updateUser);
router.delete('/:id', validateToken, deleteUser);

export default router;
