import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import ExpenseForm from '../components/ExpenseForm';
import ExpenseList from '../components/ExpenseList';

export default function DashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => api.getExpenses(),
    staleTime: 30_000,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.getCategories(),
    staleTime: 60_000,
  });

  const addMutation = useMutation({
    mutationFn: api.addExpense,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['expenses'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteExpense,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['expenses'] }),
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm font-bold">$</span>
            </div>
            <h1 className="text-lg font-bold text-gray-900">Expenses</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-400">
              {expenses.length} expense{expenses.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={() => navigate('/categories')}
              className="text-xs text-gray-500 hover:text-gray-700 transition-colors cursor-pointer"
            >
              Categories
            </button>
            <button
              onClick={async () => {
                await api.logout();
                queryClient.clear();
                navigate('/login');
              }}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <ExpenseForm categories={categories} onAdd={(data) => addMutation.mutateAsync(data)} />

        {isLoading ? (
          <div className="text-center py-12 text-gray-400">Loading...</div>
        ) : (
          <ExpenseList
            expenses={expenses}
            onDelete={(id) => deleteMutation.mutate(id)}
          />
        )}
      </main>
    </div>
  );
}
