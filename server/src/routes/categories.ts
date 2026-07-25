import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { getCategories, addCategory, deleteCategory } from '../services/googleSheets';

const router = Router();

router.use(requireAuth);

router.get('/', async (req: Request, res: Response) => {
  try {
    const data = await getCategories(req.session.googleUserId!);
    res.json(data);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    await addCategory(req.session.googleUserId!, name);
    res.status(201).json({ name });
  } catch (error) {
    console.error('Error adding category:', error);
    res.status(500).json({ error: 'Failed to add category' });
  }
});

router.delete('/:name', async (req: Request, res: Response) => {
  try {
    const name = req.params.name as string;
    await deleteCategory(req.session.googleUserId!, name);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

export default router;
