import { useState } from 'react';

interface Props {
  categories: string[];
  onAdd: (name: string) => Promise<void>;
  onDelete: (name: string) => void;
}

export default function CategoryManager({ categories, onAdd, onDelete }: Props) {
  const [newCategory, setNewCategory] = useState('');
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    if (!newCategory.trim()) return;
    setAdding(true);
    try {
      await onAdd(newCategory.trim());
      setNewCategory('');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100">
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="flex gap-2">
          <input
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="New category name"
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
          />
          <button
            onClick={handleAdd}
            disabled={adding || !newCategory.trim()}
            className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {adding ? 'Adding...' : 'Add'}
          </button>
        </div>
      </div>
      <div className="divide-y divide-gray-50">
        {categories.map((cat) => (
          <div key={cat} className="flex items-center justify-between px-5 py-3">
            <span className="text-sm text-gray-700">{cat}</span>
            <button
              onClick={() => onDelete(cat)}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
            >
              Delete
            </button>
          </div>
        ))}
        {categories.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-6">No categories yet</p>
        )}
      </div>
    </div>
  );
}
