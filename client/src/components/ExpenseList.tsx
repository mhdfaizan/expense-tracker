import type { Expense } from '../types';

interface Props {
  expenses: Expense[];
  onDelete: (id: string) => void;
}

function groupByDate(expenses: Expense[]): Record<string, Expense[]> {
  const groups: Record<string, Expense[]> = {};
  for (const expense of expenses) {
    if (!groups[expense.date]) groups[expense.date] = [];
    groups[expense.date].push(expense);
  }
  return groups;
}

export default function ExpenseList({ expenses, onDelete }: Props) {
  const groups = groupByDate(expenses);
  const dates = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  if (expenses.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p className="text-lg">No expenses yet</p>
        <p className="text-sm mt-1">Add your first expense above</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {dates.map((date) => {
        const dayTotal = groups[date].reduce((sum, e) => sum + e.cost, 0);
        return (
          <div key={date}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-500">
                {new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </h3>
              <span className="text-sm font-semibold text-gray-700">
                ${dayTotal.toFixed(2)}
              </span>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              {groups[date].map((expense) => (
                <div key={expense.id} className="flex items-center justify-between px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-gray-300" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{expense.item}</p>
                      <p className="text-xs text-gray-400">{expense.category}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-700">${expense.cost.toFixed(2)}</span>
                    <button
                      onClick={() => onDelete(expense.id)}
                      className="text-gray-300 hover:text-red-500 transition-colors cursor-pointer"
                      title="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
