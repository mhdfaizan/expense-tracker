import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from '../middleware/auth';
import { appendExpense, getExpenses, deleteExpense } from '../services/googleSheets';

const router = Router();

router.use(requireAuth);

router.get('/', async (req: Request, res: Response) => {
  try {
    const dateFilter = req.query.date as string | undefined;
    const data = await getExpenses(req.session.googleUserId!, dateFilter);
    res.json(data);
  } catch (error) {
    console.error('Error fetching expenses:', error);
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { item, cost, category, date } = req.body;
    if (!item || cost === undefined || !category) {
      return res.status(400).json({ error: 'item, cost, and category are required' });
    }

    const expenseDate = date || new Date().toISOString().split('T')[0];
    const id = uuidv4();

    await appendExpense(req.session.googleUserId!, expenseDate, item, cost, category, id);
    res.status(201).json({ id, date: expenseDate, item, cost, category });
  } catch (error) {
    console.error('Error adding expense:', error);
    res.status(500).json({ error: 'Failed to add expense' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    await deleteExpense(req.session.googleUserId!, id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting expense:', error);
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

export default router;
