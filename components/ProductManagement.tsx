
import React, { useState, useRef, useEffect } from 'react';
import { Product, Category, Order, Table, User, Shift, UserRole, ViewState, StoreSettings, ComboOption, ModifierGroup, Modifier, Ingredient, RecipeItem } from '../types';
import { Icons } from '../constants';

interface ProductManagementProps {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  categories: Category[];
  setCategories: React.Dispatch<React.SetStateAction<Category[]>>;
  tables: Table[];
  setTables: React.Dispatch<React.SetStateAction<Table[]>>;
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  settings: StoreSettings;
  onUpdateSettings: (settings: StoreSettings) => void;
  onRestoreDatabase: (data: any) => void;
  onFactoryReset: () => void;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  shifts: Shift[];
  roles: UserRole[];
  setRoles: React.Dispatch<React.SetStateAction<UserRole[]>>;
  ingredients: Ingredient[];
  setIngredients: React.Dispatch<React.SetStateAction<Ingredient[]>>;
  initialTab?: 'products' | 'categories' | 'tables' | 'general' | 'users' | 'shifts' | 'roles' | 'inventory';
  activeTab?: 'overview' | 'history' | 'products' | 'categories' | 'inventory' | 'tables' | 'users' | 'roles' | 'shifts' | 'general';
}

interface BackupPreview {
  products: Product[];
  categories: Category[];
  tables: Table[];
  orders: Order[];
  users: User[];
  settings: StoreSettings;
  fileName: string;
}

import ConfirmationModal from './ConfirmationModal';

const ProductManagement: React.FC<ProductManagementProps> = ({ 
  products, 
  setProducts, 
  categories, 
  setCategories,
  tables,
  setTables,
  orders,
  setOrders,
  settings,
  onUpdateSettings,
  onRestoreDatabase,
  onFactoryReset,
  users,
  setUsers,
  shifts,
  roles,
  setRoles,
  ingredients,
  setIngredients,
  activeTab = 'products'
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const productsFileInputRef = useRef<HTMLInputElement>(null);
  const categoriesFileInputRef = useRef<HTMLInputElement>(null);
  const backupFileInputRef = useRef<HTMLInputElement>(null);

  const downloadCSV = (content: string, fileName: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportProductsToCSV = () => {
    const header = "id,name,price,category,hasCombo,comboOptionsSerialized,modifierGroupsSerialized\n";
    const rows = products.map(p => 
      `${p.id},"${p.name.replace(/"/g, '""')}",${p.price},"${p.category.replace(/"/g, '""')}",${!!p.hasCombo},"${JSON.stringify(p.comboOptions || []).replace(/"/g, '""')}","${JSON.stringify(p.modifierGroups || []).replace(/"/g, '""')}"`
    ).join("\n");
    downloadCSV(header + rows, "productos.csv");
  };

  const handleImportProducts = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        const text = event.target?.result as string;
        const lines = text.split('\n').filter(l => l.trim()).slice(1);
        const newProducts: Product[] = lines.map(line => {
            const [id, name, price, category, hasCombo, comboOptionsSerialized, modifierGroupsSerialized] = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(s => s ? s.replace(/^"|"$/g, '').replace(/""/g, '"') : '');
            return {
                id, 
                name, 
                price: Number(price), 
                category, 
                hasCombo: hasCombo === 'true', 
                comboOptions: JSON.parse(comboOptionsSerialized || '[]'),
                modifierGroups: JSON.parse(modifierGroupsSerialized || '[]')
            };
        });
        setProducts(newProducts);
        alert(`${newProducts.length} productos importados.`);
    };
    reader.readAsText(file);
    if(productsFileInputRef.current) productsFileInputRef.current.value = '';
  };

  const exportCategoriesToCSV = () => {
    const header = "name\n";
    const rows = categories.map(c => `"${c.replace(/"/g, '""')}"`).join("\n");
    downloadCSV(header + rows, "categorias.csv");
  };

  const handleImportCategories = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        const text = event.target?.result as string;
        const lines = text.split('\n').filter(l => l.trim()).slice(1);
        const newCategories = lines.map(line => line.replace(/^"|"$/g, '').replace(/""/g, '"'));
        setCategories(newCategories);
        alert(`${newCategories.length} categorías importadas.`);
    };
    reader.readAsText(file);
    if(categoriesFileInputRef.current) categoriesFileInputRef.current.value = '';
  };

  // Confirmation state
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type: 'danger' | 'warning';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'danger'
  });

  const triggerConfirm = (title: string, message: string, onConfirm: () => void, type: 'danger' | 'warning' = 'danger') => {
    setConfirmState({ isOpen: true, title, message, onConfirm, type });
  };

  const [resetStep, setResetStep] = useState(0);
  const [resetPin, setResetPin] = useState('');
  const [resetError, setResetError] = useState('');

  // General Settings Form
  const [formSettings, setFormSettings] = useState<StoreSettings>(settings);

  // Backup Import State
  const [preview, setPreview] = useState<BackupPreview | null>(null);

  // Sync internal form with props when they change (critical for imports)
  useEffect(() => {
    setFormSettings(settings);
  }, [settings]);

  // Product Form State
  const [name, setName] = useState('');
  const [price, setPrice] = useState(0);
  const [category, setCategory] = useState<Category>('');
  const [hasCombo, setHasCombo] = useState(false);
  const [comboOptions, setComboOptions] = useState<ComboOption[]>([]);
  const [modifierGroups, setModifierGroups] = useState<ModifierGroup[]>([]);
  const [recipe, setRecipe] = useState<RecipeItem[]>([]);

  // Modifiers Form State
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupRequired, setNewGroupRequired] = useState(false);
  const [newGroupMax, setNewGroupMax] = useState(1);
  const [newModifierName, setNewModifierName] = useState('');
  const [newModifierPrice, setNewModifierPrice] = useState(0);
  const [newModifierRecipe, setNewModifierRecipe] = useState<RecipeItem[]>([]);
  const [activeGroupIndex, setActiveGroupIndex] = useState<number | null>(null);

  // Reset state when tab changes
  useEffect(() => {
    setIsAdding(false);
    setEditingId(null);
    resetProductForm();
    resetIngredientForm();
    resetUserForm();
    setRoleFormName('');
    setRoleFormPermissions([]);
  }, [activeTab]);

  // Category Form State
  const [newCatName, setNewCatName] = useState('');
  const [newComboOptionLabel, setNewComboOptionLabel] = useState('');
  const [newComboOptionPrice, setNewComboOptionPrice] = useState(0);

  // Ingredient Form State
  const [ingName, setIngName] = useState('');
  const [ingStock, setIngStock] = useState(0);
  const [ingMinStock, setIngMinStock] = useState(0);
  const [ingUnit, setIngUnit] = useState<'g' | 'unit' | 'ml'>('g');

  // Recipe Selection State
  const [recipeIngId, setRecipeIngId] = useState('');
  const [recipeQty, setRecipeQty] = useState(0);

  // Table Form State
  const [newTableName, setNewTableName] = useState('');

  // User Form State
  const [useFormName, setUserFormName] = useState('');
  const [userFormPin, setUserFormPin] = useState('');
  const [userFormRole, setUserFormRole] = useState<string>('Caja');

  const handleSaveProduct = () => {
    if (!name || price <= 0 || !category) return;

    const cleanProduct: Product = {
      id: editingId || Date.now().toString(),
      name,
      price,
      category,
      hasCombo,
      comboOptions: hasCombo ? comboOptions : undefined,
      modifierGroups: modifierGroups.length > 0 ? modifierGroups : undefined,
      recipe: recipe.length > 0 ? recipe : undefined
    };

    if (editingId) {
      setProducts(prev => prev.map(p => p.id === editingId ? cleanProduct : p));
      setEditingId(null);
    } else {
      setProducts(prev => [...prev, cleanProduct]);
      setIsAdding(false);
    }
    resetProductForm();
  };

  const handleSaveUser = () => {
    if (!useFormName || userFormPin.length !== 4 || !userFormRole) {
      alert('Completa todos los campos correctamente. El PIN debe tener 4 dígitos.');
      return;
    }

    if (editingId) {
      setUsers(prev => prev.map(u => 
        u.id === editingId ? { ...u, name: useFormName, pin: userFormPin, role: userFormRole } : u
      ));
      setEditingId(null);
    } else {
      const newUser: User = {
        id: Date.now().toString(),
        name: useFormName,
        pin: userFormPin,
        role: userFormRole,
      };
      setUsers(prev => [...prev, newUser]);
      setIsAdding(false);
    }
    resetUserForm();
  };

  const resetUserForm = () => {
    setUserFormName('');
    setUserFormPin('');
    setUserFormRole('Caja');
  };

  const startEditUser = (u: User) => {
    setEditingId(u.id);
    setUserFormName(u.name);
    setUserFormPin(u.pin);
    setUserFormRole(u.role);
    setIsAdding(false);
  };

  const deleteUser = (id: string) => {
    if (id === 'admin') {
      alert('No se puede eliminar el usuario administrador principal.');
      return;
    }
    const user = users.find(u => u.id === id);
    if (!user) return;
    
    triggerConfirm(
      'Eliminar Usuario',
      `¿Estás seguro de eliminar al usuario "${user.name}"?`,
      () => setUsers(prev => prev.filter(u => u.id !== id))
    );
  };

  const resetProductForm = () => {
    setName('');
    setPrice(0);
    setCategory(categories[0] || '');
    setHasCombo(false);
    setComboOptions([]);
    setModifierGroups([]);
    setRecipe([]);
    setActiveGroupIndex(null);
    setNewGroupName('');
  };

  const addModifierGroup = () => {
    if (!newGroupName.trim()) return;
    const newGroup: ModifierGroup = {
      id: Date.now().toString(),
      name: newGroupName,
      minSelection: newGroupRequired ? 1 : 0,
      maxSelection: newGroupMax,
      isRequired: newGroupRequired,
      modifiers: []
    };
    setModifierGroups(prev => [...prev, newGroup]);
    setNewGroupName('');
    setNewGroupRequired(false);
    setNewGroupMax(1);
  };

  const addModifierToGroup = (groupIndex: number) => {
    if (!newModifierName.trim()) return;
    setModifierGroups(prev => prev.map((group, idx) => {
      if (idx !== groupIndex) return group;
      return {
        ...group,
        modifiers: [...group.modifiers, {
          id: Date.now().toString(),
          name: newModifierName,
          extraPrice: newModifierPrice,
          recipe: newModifierRecipe
        }]
      };
    }));
    setNewModifierName('');
    setNewModifierPrice(0);
    setNewModifierRecipe([]);
  };

  const removeModifier = (groupIndex: number, modId: string) => {
    setModifierGroups(prev => prev.map((group, idx) => {
      if (idx !== groupIndex) return group;
      return { ...group, modifiers: group.modifiers.filter(m => m.id !== modId) };
    }));
  };

  const removeGroup = (idx: number) => {
    setModifierGroups(prev => prev.filter((_, i) => i !== idx));
    if (activeGroupIndex === idx) setActiveGroupIndex(null);
  };

  const addIngredientToRecipe = () => {
    if (!recipeIngId || recipeQty <= 0) return;
    setRecipe(prev => {
      const existing = prev.find(r => r.ingredientId === recipeIngId);
      if (existing) {
        return prev.map(r => r.ingredientId === recipeIngId ? { ...r, quantity: recipeQty } : r);
      }
      return [...prev, { ingredientId: recipeIngId, quantity: recipeQty }];
    });
    setRecipeIngId('');
    setRecipeQty(0);
  };

  const removeIngredientFromRecipe = (id: string) => {
    setRecipe(prev => prev.filter(r => r.ingredientId !== id));
  };

  const handleSaveIngredient = () => {
    if (!ingName || ingStock < 0) return;
    
    if (editingId) {
      setIngredients(prev => prev.map(i => i.id === editingId ? { ...i, name: ingName, stock: ingStock, minStock: ingMinStock, unit: ingUnit } : i));
      setEditingId(null);
    } else {
      const newIng: Ingredient = {
        id: Date.now().toString(),
        name: ingName,
        stock: ingStock,
        minStock: ingMinStock,
        unit: ingUnit
      };
      setIngredients(prev => [...prev, newIng]);
      setIsAdding(false);
    }
    resetIngredientForm();
  };

  const resetIngredientForm = () => {
    setIngName('');
    setIngStock(0);
    setIngMinStock(0);
    setIngUnit('g');
  };

  const startEditIngredient = (i: Ingredient) => {
    setEditingId(i.id);
    setIngName(i.name);
    setIngStock(i.stock);
    setIngMinStock(i.minStock);
    setIngUnit(i.unit || 'g');
    setIsAdding(false);
  };

  const deleteIngredient = (id: string) => {
    const ing = ingredients.find(i => i.id === id);
    if (!ing) return;
    
    const inUse = products.some(p => p.recipe?.some(r => r.ingredientId === id));
    if (inUse) {
      alert(`El ingrediente "${ing.name}" está siendo usado en una o más recetas.`);
      return;
    }

    triggerConfirm(
      'Eliminar Ingrediente',
      `¿Eliminar "${ing.name}" del catálogo?`,
      () => setIngredients(prev => prev.filter(i => i.id !== id))
    );
  };

  const exportIngredientsToCSV = () => {
    const header = "id,name,stock,minStock,unit\n";
    const rows = ingredients.map(i => `${i.id},"${i.name.replace(/"/g, '""')}",${i.stock},${i.minStock},${i.unit}`).join("\n");
    downloadCSV(header + rows, "inventario.csv");
  };

  const handleImportIngredients = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        const text = event.target?.result as string;
        const lines = text.split('\n').filter(l => l.trim()).slice(1);
        const newIngs: Ingredient[] = lines.map(line => {
            const [id, name, stock, minStock, unit] = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(s => s ? s.replace(/^"|"$/g, '').replace(/""/g, '"') : '');
            return {
                id, name, stock: Number(stock), minStock: Number(minStock), unit: (unit as any) || 'g'
            };
        });
        setIngredients(newIngs);
        alert(`${newIngs.length} ingredientes importados.`);
    };
    reader.readAsText(file);
  };

  const handleAddComboOption = () => {
    if (!newComboOptionLabel.trim()) return;
    setComboOptions(prev => [...prev, {
      id: Date.now().toString(),
      label: newComboOptionLabel,
      extraPrice: newComboOptionPrice
    }]);
    setNewComboOptionLabel('');
    setNewComboOptionPrice(0);
  };

  // Role Management State
  const [roleFormName, setRoleFormName] = useState('');
  const [roleFormPermissions, setRoleFormPermissions] = useState<ViewState[]>([]);

  const handleSaveRole = () => {
    if (!roleFormName) return;
    
    if (editingId) {
      setRoles(prev => prev.map(r => r.name === editingId ? { name: roleFormName, permissions: roleFormPermissions } : r));
      setEditingId(null);
    } else {
      if (roles.some(r => r.name === roleFormName)) {
        alert('Este rol ya existe.');
        return;
      }
      setRoles(prev => [...prev, { name: roleFormName, permissions: roleFormPermissions }]);
      setIsAdding(false);
    }
    setRoleFormName('');
    setRoleFormPermissions([]);
  };

  const deleteRole = (name: string) => {
    if (name === 'Admin') {
      alert('No se puede eliminar el rol de Administrador.');
      return;
    }
    if (users.some(u => u.role === name)) {
      alert('No se puede eliminar un rol asignado a usuarios.');
      return;
    }
    triggerConfirm(
      'Eliminar Rol',
      `¿Deseas eliminar el rol "${name}"?`,
      () => setRoles(prev => prev.filter(r => r.name !== name))
    );
  };

  const togglePermission = (view: ViewState) => {
    setRoleFormPermissions(prev => 
      prev.includes(view) ? prev.filter(v => v !== view) : [...prev, view]
    );
  };

  const availableViews: {id: ViewState, label: string}[] = [
    { id: 'pos', label: 'Venta (POS)' },
    { id: 'tables', label: 'Mesas' },
    { id: 'dispatch', label: 'Cocina (Dispatch)' },
    { id: 'central', label: 'Centro de Control (CRM)' },
    { id: 'cash_audit', label: 'Auditoría de Caja' },
  ];

  const startEditProduct = (p: Product) => {
    setEditingId(p.id);
    setName(p.name);
    setPrice(p.price);
    setCategory(p.category);
    setHasCombo(!!p.hasCombo);
    setComboOptions(p.comboOptions || []);
    setModifierGroups(p.modifierGroups || []);
    setRecipe(p.recipe || []);
    setIsAdding(false);
  };

  const deleteProduct = (id: string) => {
    const product = products.find(p => p.id === id);
    if (!product) return;
    
    triggerConfirm(
      'Eliminar Producto',
      `¿Estás seguro de eliminar "${product.name}"? Esta acción no se puede deshacer.`,
      () => setProducts(prev => prev.filter(p => p.id !== id))
    );
  };

  const handleAddCategory = () => {
    const trimmed = newCatName.trim();
    if (!trimmed) return;
    if (categories.includes(trimmed)) {
      alert('Esta categoría ya existe.');
      return;
    }
    setCategories(prev => [...prev, trimmed]);
    setNewCatName('');
  };

  const handleDeleteCategory = (cat: Category) => {
    const inUse = products.some(p => p.category === cat);
    if (inUse) {
      alert(`No se puede eliminar "${cat}" porque está siendo usada por algunos productos.`);
      return;
    }
    
    triggerConfirm(
      'Eliminar Categoría',
      `¿Eliminar categoría "${cat}"? Se quitará de la lista de filtros.`,
      () => setCategories(prev => prev.filter(c => c !== cat))
    );
  };

  const handleAddTable = () => {
    const trimmed = newTableName.trim();
    if (!trimmed) return;
    if (tables.some(t => t.name === trimmed)) {
      alert('Esta mesa ya existe.');
      return;
    }
    const newTable: Table = {
      id: Date.now().toString(),
      name: trimmed,
      status: 'free'
    };
    setTables(prev => [...prev, newTable]);
    setNewTableName('');
  };

  const handleDeleteTable = (id: string) => {
    const table = tables.find(t => t.id === id);
    if (!table) return;
    
    // Check if table has active order
    const hasOrder = orders.some(o => o.table === table.name && !o.isPaid);
    if (hasOrder) {
      alert('No se puede eliminar una mesa con una cuenta abierta.');
      return;
    }

    triggerConfirm(
      'Eliminar Mesa',
      `¿Eliminar mesa "${table.name}"? Los registros históricos se preservarán, pero no podrá abrir nuevas órdenes aquí.`,
      () => setTables(prev => prev.filter(t => t.id !== id))
    );
  };

  const handleSaveGeneral = () => {
    onUpdateSettings(formSettings);
    alert('Configuración actualizada');
  };

  const handleFactoryReset = () => {
    const adminUser = users.find(u => u.role === 'Admin');
    if (!adminUser) {
      setResetError('No se encontró un administrador.');
      return;
    }
    if (resetPin !== adminUser.pin) {
      setResetError('PIN Incorrecto.');
      return;
    }
    // Call the centralized reset logic from App.tsx
    onFactoryReset();
  };

  // BACKUP LOGIC
  const handleExportData = () => {
    const data = {
      products,
      categories,
      tables,
      orders,
      users,
      settings,
      exportDate: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dospos_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);

        // Validaciones básicas de estructura
        if (!data.products || !data.categories) {
          throw new Error("El archivo no es un respaldo válido de DosPOS.");
        }

        setPreview({
          products: data.products || [],
          categories: data.categories || [],
          tables: data.tables || [],
          orders: data.orders || [],
          users: data.users || [],
          settings: data.settings || settings,
          fileName: file.name
        });
      } catch (err) {
        console.error("Error al leer archivo:", err);
        alert('Error al procesar el archivo: ' + (err instanceof Error ? err.message : 'Formato inválido'));
        setPreview(null);
      }
    };
    reader.readAsText(file);
    if (backupFileInputRef.current) backupFileInputRef.current.value = '';
  };

  const applyBackup = () => {
    if (!preview) return;

    triggerConfirm(
      'Restaurar Respaldo',
      'ATENCIÓN: Se borrarán todos los datos actuales y se reemplazarán por los del respaldo. Esta acción es irreversible.',
      () => {
        try {
          onRestoreDatabase(preview);
          alert('Base de datos restaurada con éxito.');
          setPreview(null);
        } catch (error) {
          console.error("Error durante applyBackup:", error);
          alert("Ocurrió un error al aplicar el respaldo.");
        }
      },
      'warning'
    );
  };

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6 overflow-hidden">
      {activeTab === 'products' && (
        <>
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Menú de Ventas</h2>
            {!isAdding && !editingId && (
              <div className="flex items-center space-x-2">
                <button 
                  onClick={exportProductsToCSV}
                  className="bg-slate-200 text-slate-700 px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-300 transition"
                >
                  Exportar
                </button>
                <input type="file" ref={productsFileInputRef} onChange={handleImportProducts} accept=".csv" className="hidden" />
                <button 
                  onClick={() => productsFileInputRef.current?.click()}
                  className="bg-slate-200 text-slate-700 px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-300 transition"
                >
                  Importar
                </button>
                <button 
                  onClick={() => {
                    setEditingId(null);
                    setIsAdding(true);
                    if (categories.length > 0) setCategory(categories[0]);
                  }}
                  className="bg-red-600 text-white px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest flex items-center space-x-2 hover:bg-red-700 transition shadow-lg shadow-red-100"
                >
                  <Icons.Plus /> <span>Nuevo</span>
                </button>
              </div>
            )}
          </div>

          {(isAdding || editingId) && (
            <div className="bg-white p-6 rounded-3xl border-2 border-red-600 shadow-xl animate-in zoom-in duration-200 flex flex-col">
              <div className="flex justify-between items-center mb-6 border-b pb-4 sticky top-0 bg-white z-10">
                <h3 className="font-black text-black uppercase tracking-widest">{editingId ? 'Editar' : 'Agregar'} Item</h3>
                <div className="flex space-x-3">
                  <button 
                    onClick={() => { setIsAdding(false); setEditingId(null); resetProductForm(); }}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={handleSaveProduct}
                    className="px-6 py-2 bg-black text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 shadow-lg"
                  >
                    Guardar
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nombre del Item</label>
                  <input 
                    type="text" value={name} onChange={e => setName(e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-600 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Precio</label>
                  <input 
                    type="number" value={price} onChange={e => setPrice(Number(e.target.value))}
                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-600 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Categoría</label>
                  <select 
                    value={category} onChange={e => setCategory(e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-600 outline-none"
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label className="flex items-center space-x-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <input type="checkbox" checked={hasCombo} onChange={e => setHasCombo(e.target.checked)} className="rounded border-slate-300 text-red-600 focus:ring-red-500" />
                    <span>¿Soporta Combo?</span>
                  </label>
                  {hasCombo && (
                    <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="flex gap-2 mb-4">
                        <input type="text" placeholder="Opción (ej. Papas)" value={newComboOptionLabel} onChange={e => setNewComboOptionLabel(e.target.value)} className="flex-1 p-2 rounded-lg border border-slate-200 text-xs" />
                        <input type="number" placeholder="$ Extra" value={newComboOptionPrice} onChange={e => setNewComboOptionPrice(Number(e.target.value))} className="w-20 p-2 rounded-lg border border-slate-200 text-xs" />
                        <button onClick={handleAddComboOption} className="bg-black text-white px-4 rounded-lg text-xs font-black">+</button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {comboOptions.map(opt => (
                          <div key={opt.id} className="flex justify-between items-center p-2 bg-white rounded border border-slate-200 text-[10px] font-bold">
                            <span>{opt.label} (+$ {opt.extraPrice})</span>
                            <button onClick={() => setComboOptions(prev => prev.filter(o => o.id !== opt.id))} className="text-red-500 hover:text-red-700">×</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Recipe Section */}
                <div className="space-y-4 sm:col-span-3 border-t pt-6">
                  <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <div>
                      <h4 className="font-black text-slate-900 uppercase tracking-tighter text-sm">Receta / Insumos (Gramos)</h4>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Ingredientes que se descuentan del inventario</p>
                    </div>
                  </div>

                  <div className="flex flex-col md:flex-row gap-4 mb-4">
                    <div className="flex-1">
                      <select 
                        value={recipeIngId} onChange={e => setRecipeIngId(e.target.value)}
                        className="w-full p-3 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-red-600 outline-none"
                      >
                        <option value="">Seleccionar ingrediente...</option>
                        {ingredients.map(ing => (
                          <option key={ing.id} value={ing.id}>{ing.name} (Stock: {ing.stock}g)</option>
                        ))}
                      </select>
                    </div>
                    <div className="w-full md:w-32">
                      <input 
                        type="number" placeholder="Gramos" value={recipeQty} onChange={e => setRecipeQty(Number(e.target.value))}
                        className="w-full p-3 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-red-600 outline-none"
                      />
                    </div>
                    <button 
                      onClick={addIngredientToRecipe}
                      className="bg-black text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition"
                    >
                      Añadir a Receta
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {recipe.map(item => {
                      const ing = ingredients.find(i => i.id === item.ingredientId);
                      return (
                        <div key={item.ingredientId} className="flex justify-between items-center p-3 bg-white rounded-xl border border-slate-100 shadow-sm transition hover:border-red-200">
                          <div className="flex-grow">
                            <p className="text-[10px] font-black text-slate-900 uppercase truncate">{ing?.name || 'Desconocido'}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <input 
                                type="number" 
                                className="w-16 p-1 rounded-lg bg-slate-50 border border-slate-200 text-[10px] font-black focus:ring-1 focus:ring-red-600 outline-none" 
                                value={item.quantity} 
                                onChange={(e) => setRecipe(prev => prev.map(r => r.ingredientId === item.ingredientId ? { ...r, quantity: Number(e.target.value) } : r))}
                              />
                              <span className="text-[10px] font-black text-slate-400 uppercase">gramos</span>
                            </div>
                          </div>
                          <button onClick={() => removeIngredientFromRecipe(item.ingredientId)} className="ml-3 p-1 text-slate-300 hover:text-red-600 transition">
                            <Icons.Trash size={14} />
                          </button>
                        </div>
                      );
                    })}
                    {recipe.length === 0 && (
                      <div className="col-span-full py-8 text-center border-2 border-dashed border-slate-100 rounded-2xl opacity-50">
                        <Icons.Activity size={24} className="mx-auto mb-2 text-slate-300" />
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sin ingredientes asociados</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Modifiers Support Section */}
                <div className="space-y-4 sm:col-span-3 border-t pt-6 mt-4">
                  <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <div>
                      <h4 className="font-black text-slate-900 uppercase tracking-tighter text-sm">Grupos de Modificadores</h4>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Extras o ingredientes a remover</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Add Group Column */}
                    <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                      <h5 className="text-[10px] font-black text-slate-600 uppercase tracking-widest border-b pb-2">Crear Nuevo Grupo</h5>
                      <div className="space-y-3">
                         <input 
                          type="text" value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
                          placeholder="Nombre del Grupo (ej. Ingredientes Extra)"
                          className="w-full p-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-red-600 outline-none"
                         />
                         <div className="flex items-center justify-between">
                            <label className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase cursor-pointer">
                              <input type="checkbox" checked={newGroupRequired} onChange={e => setNewGroupRequired(e.target.checked)} className="rounded text-red-600" />
                              <span>¿Es Obligatorio?</span>
                            </label>
                            <div className="flex items-center space-x-2">
                               <span className="text-[10px] font-black text-slate-500 uppercase">Máx Selec.</span>
                               <input 
                                type="number" min={1} value={newGroupMax} onChange={e => setNewGroupMax(Number(e.target.value))}
                                className="w-14 p-2 rounded-lg border border-slate-200 text-xs"
                               />
                            </div>
                         </div>
                         <button 
                          onClick={addModifierGroup}
                          className="w-full py-2.5 bg-black text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition"
                         >
                           Añadir Grupo
                         </button>
                      </div>
                    </div>

                    {/* Preview/Edit Groups Column */}
                    <div className="space-y-3">
                      {modifierGroups.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center p-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200 opacity-50">
                           <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Sin modificadores</p>
                        </div>
                      ) : (
                        modifierGroups.map((group, gIdx) => (
                          <div key={group.id} className={`p-4 rounded-2xl border-2 transition-all ${activeGroupIndex === gIdx ? 'border-red-600 bg-red-50/30' : 'border-slate-100 bg-white'}`}>
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <h6 className="font-black text-slate-900 uppercase tracking-tight text-xs flex items-center">
                                  {group.name}
                                  {group.isRequired && <span className="ml-2 text-[8px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">OBLIGATORIO</span>}
                                </h6>
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Máx. {group.maxSelection} opciones</p>
                              </div>
                              <div className="flex space-x-1">
                                <button onClick={() => setActiveGroupIndex(activeGroupIndex === gIdx ? null : gIdx)} className="p-1.5 text-slate-400 hover:text-black">
                                  <Icons.Edit size={14}/>
                                </button>
                                <button onClick={() => removeGroup(gIdx)} className="p-1.5 text-slate-400 hover:text-red-600">
                                  <Icons.Trash size={14}/>
                                </button>
                              </div>
                            </div>

                            {/* Modifiers List in Group */}
                            <div className="flex flex-wrap gap-2 mb-3">
                              {group.modifiers.map(mod => (
                                <span key={mod.id} className="inline-flex items-center px-2 py-1 bg-white border border-slate-200 rounded-lg text-[9px] font-black text-slate-600 uppercase tracking-tighter shadow-sm">
                                  {mod.name} {mod.extraPrice > 0 && <span className="ml-1 text-green-600">(+${mod.extraPrice})</span>}
                                  <button onClick={() => removeModifier(gIdx, mod.id)} className="ml-2 text-slate-300 hover:text-red-600">×</button>
                                </span>
                              ))}
                            </div>

                            {/* Add Modifier to Group Form */}
                            {activeGroupIndex === gIdx && (
                              <div className="mt-3 p-3 bg-white rounded-xl border border-red-100 space-y-3 animate-in slide-in-from-top-2">
                                <div className="flex gap-2">
                                  <input 
                                    type="text" placeholder="Nombre Modif." value={newModifierName} onChange={e => setNewModifierName(e.target.value)}
                                    className="flex-1 p-2 rounded-lg border border-slate-200 text-[10px] focus:ring-1 focus:ring-red-600 outline-none"
                                  />
                                  <input 
                                    type="number" placeholder="$ Extra" value={newModifierPrice} onChange={e => setNewModifierPrice(Number(e.target.value))}
                                    className="w-16 p-2 rounded-lg border border-slate-200 text-[10px] focus:ring-1 focus:ring-red-600 outline-none"
                                  />
                                </div>
                                <div className="space-y-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                   <p className="text-[8px] font-black uppercase text-slate-400 mb-1">Receta Modificador</p>
                                   <div className="flex gap-1">
                                      <select 
                                        className="flex-1 p-1.5 rounded bg-white border border-slate-200 text-[10px] outline-none"
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          if(!val) return;
                                          if(!newModifierRecipe.find(r => r.ingredientId === val)) {
                                            setNewModifierRecipe([...newModifierRecipe, { ingredientId: val, quantity: 0 }]);
                                          }
                                        }}
                                        value=""
                                      >
                                        <option value="">+ Añadir Insumo...</option>
                                        {ingredients.map(ing => (
                                          <option key={ing.id} value={ing.id}>{ing.name}</option>
                                        ))}
                                      </select>
                                   </div>
                                   <div className="space-y-1">
                                      {newModifierRecipe.map(ri => {
                                        const ing = ingredients.find(i => i.id === ri.ingredientId);
                                        return (
                                          <div key={ri.ingredientId} className="flex items-center justify-between gap-2">
                                            <span className="text-[9px] font-bold text-slate-600 truncate">{ing?.name}</span>
                                            <div className="flex items-center gap-1">
                                              <input 
                                                type="number" 
                                                className="w-10 p-1 rounded border border-slate-200 text-[9px]" 
                                                value={ri.quantity} 
                                                onChange={(e) => setNewModifierRecipe(prev => prev.map(r => r.ingredientId === ri.ingredientId ? { ...r, quantity: Number(e.target.value) } : r))}
                                              />
                                              <span className="text-[8px] text-slate-400">g</span>
                                              <button onClick={() => setNewModifierRecipe(prev => prev.filter(r => r.ingredientId !== ri.ingredientId))} className="text-red-400 hover:text-red-600">×</button>
                                            </div>
                                          </div>
                                        );
                                      })}
                                   </div>
                                </div>
                                <button onClick={() => addModifierToGroup(gIdx)} className="w-full bg-red-600 text-white p-2 rounded-lg text-[10px] font-black uppercase tracking-widest">Añadir Modificador</button>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
            <table className="w-full text-left min-w-[500px] md:min-w-0">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Item</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Categoría</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Precio</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {products.map(product => (
                  <tr key={product.id} className="hover:bg-red-50/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900">{product.name}</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {product.hasCombo && (
                            <span className="text-[7px] font-black bg-blue-50 text-blue-600 border border-blue-100 px-1.5 py-0.5 rounded-md uppercase tracking-tighter flex items-center">
                              <span className="w-1 h-1 bg-blue-600 rounded-full mr-1"></span>
                              Combo
                            </span>
                          )}
                          {product.modifierGroups && product.modifierGroups.length > 0 && (
                            <span className="text-[7px] font-black bg-purple-50 text-purple-600 border border-purple-100 px-1.5 py-0.5 rounded-md uppercase tracking-tighter flex items-center">
                              <span className="w-1 h-1 bg-purple-600 rounded-full mr-1"></span>
                              Opciones
                            </span>
                          )}
                          {product.recipe && product.recipe.length > 0 && (
                            <span className="text-[7px] font-black bg-orange-50 text-orange-600 border border-orange-100 px-1.5 py-0.5 rounded-md uppercase tracking-tighter flex items-center">
                              <span className="w-1 h-1 bg-orange-600 rounded-full mr-1"></span>
                              Receta
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[9px] font-black px-2 py-0.5 rounded border border-slate-300 uppercase bg-white text-slate-600">
                        {product.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-black text-black">${product.price}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end space-x-1">
                        <button onClick={() => startEditProduct(product)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"><Icons.Edit /></button>
                        <button onClick={() => deleteProduct(product.id)} className="p-2 text-slate-400 hover:text-black hover:bg-slate-100 rounded-lg transition"><Icons.Trash /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'inventory' && (
        <>
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Inventario de Insumos</h2>
            {!isAdding && !editingId && (
              <div className="flex items-center space-x-2">
                <button 
                  onClick={exportIngredientsToCSV}
                  className="bg-slate-200 text-slate-700 px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-300 transition"
                >
                  Exportar
                </button>
                <input type="file" id="ingImport" onChange={handleImportIngredients} accept=".csv" className="hidden" />
                <button 
                  onClick={() => document.getElementById('ingImport')?.click()}
                  className="bg-slate-200 text-slate-700 px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-300 transition"
                >
                  Importar
                </button>
                <button 
                  onClick={() => { setEditingId(null); setIsAdding(true); resetIngredientForm(); }}
                  className="bg-red-600 text-white px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest flex items-center space-x-2 hover:bg-red-700 transition"
                >
                  <Icons.Plus /> <span>Nuevo Insumo</span>
                </button>
              </div>
            )}
          </div>

          {(isAdding || editingId) && (
            <div className="bg-white p-6 rounded-3xl border-2 border-red-600 shadow-xl animate-in zoom-in duration-200">
              <div className="flex justify-between items-center mb-6 border-b pb-4">
                <h3 className="font-black text-black uppercase tracking-widest">{editingId ? 'Editar' : 'Agregar'} Insumo</h3>
                <div className="flex space-x-3">
                  <button 
                    onClick={() => { setIsAdding(false); setEditingId(null); }}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={handleSaveIngredient}
                    className="px-6 py-2 bg-black text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 shadow-lg"
                  >
                    Guardar
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
                <div className="space-y-1 sm:col-span-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nombre del Insumo</label>
                  <input 
                    type="text" value={ingName} onChange={e => setIngName(e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-600 outline-none"
                    placeholder="Ej. Mezcla Carne Al Pastor"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Unidad</label>
                  <select 
                    value={ingUnit} onChange={e => setIngUnit(e.target.value as any)}
                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-600 outline-none"
                  >
                    <option value="g">Gramos (g)</option>
                    <option value="ml">Mililitros (ml)</option>
                    <option value="unit">Unidades (unit)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Stock Actual</label>
                  <input 
                    type="number" value={ingStock} onChange={e => setIngStock(Number(e.target.value))}
                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-600 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Alerta Stock Bajo</label>
                  <input 
                    type="number" value={ingMinStock} onChange={e => setIngMinStock(Number(e.target.value))}
                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-600 outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Insumo</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Stock</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Alerta</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {ingredients.map(ing => (
                  <tr key={ing.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-900 uppercase text-xs tracking-tight">{ing.name}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className={`text-xs font-black ${ing.stock <= ing.minStock ? 'text-red-600 animate-pulse' : 'text-green-600'}`}>
                          {ing.stock} {ing.unit || 'g'}
                        </span>
                        {ing.stock <= ing.minStock && <span className="text-[8px] font-black uppercase text-red-400">¡Bajo Stock!</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500 font-bold">{ing.minStock}{ing.unit || 'g'}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end space-x-1">
                        <button onClick={() => startEditIngredient(ing)} className="p-2 text-slate-400 hover:text-red-600 transition"><Icons.Edit size={16}/></button>
                        <button onClick={() => deleteIngredient(ing.id)} className="p-2 text-slate-400 hover:text-black transition"><Icons.Trash size={16}/></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {ingredients.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-center text-slate-400 uppercase text-xs font-black tracking-widest opacity-50">No hay insumos registrados</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'categories' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Categorías</h2>
            <div className="flex items-center space-x-2">
              <button 
                onClick={exportCategoriesToCSV}
                className="bg-slate-200 text-slate-700 px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-300 transition"
              >
                Exportar
              </button>
              <input type="file" ref={categoriesFileInputRef} onChange={handleImportCategories} accept=".csv" className="hidden" />
              <button 
                onClick={() => categoriesFileInputRef.current?.click()}
                className="bg-slate-200 text-slate-700 px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-300 transition"
              >
                Importar
              </button>
            </div>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex space-x-2">
              <input 
                type="text" 
                placeholder="Nueva categoría..."
                className="flex-grow p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-600 outline-none"
                value={newCatName}
                onChange={e => setNewCatName(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && handleAddCategory()}
              />
              <button 
                onClick={handleAddCategory}
                className="bg-black text-white px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition shadow-lg"
              >
                <span>Añadir</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {categories.map(cat => (
                <div key={cat} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200 group transition hover:border-red-600 hover:bg-white">
                  <span className="font-bold text-slate-800 text-sm uppercase tracking-tight">{cat}</span>
                  <button 
                    onClick={() => handleDeleteCategory(cat)}
                    className="p-2 text-slate-300 hover:text-red-600 transition opacity-0 group-hover:opacity-100"
                  >
                    <Icons.Trash />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'tables' && (
        <div className="space-y-6">
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Gestión de Mesas</h2>
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex space-x-2">
              <input 
                type="text" 
                placeholder="Nombre de mesa (ej. Mesa 10)..."
                className="flex-grow p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-600 outline-none"
                value={newTableName}
                onChange={e => setNewTableName(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && handleAddTable()}
              />
              <button 
                onClick={handleAddTable}
                className="bg-black text-white px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition shadow-lg"
              >
                <span>Añadir</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {tables.map(table => (
                <div key={table.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200 group transition hover:border-red-600 hover:bg-white">
                  <span className="font-bold text-slate-800 text-sm uppercase tracking-tight">{table.name}</span>
                  <button 
                    onClick={() => handleDeleteTable(table.id)}
                    className="p-2 text-slate-300 hover:text-red-600 transition opacity-0 group-hover:opacity-100"
                  >
                    <Icons.Trash />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <>
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Gestión de Usuarios</h2>
            {!isAdding && !editingId && (
              <button 
                onClick={() => { setEditingId(null); setIsAdding(true); }}
                className="bg-red-600 text-white px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest flex items-center space-x-2 hover:bg-red-700 transition shadow-lg shadow-red-100"
              >
                <Icons.Plus /> <span>Nuevo Usuario</span>
              </button>
            )}
          </div>

          {(isAdding || editingId) && (
            <div className="bg-white p-6 rounded-3xl border-2 border-red-600 shadow-xl animate-in zoom-in duration-200">
              <div className="flex justify-between items-center mb-6 border-b pb-4">
                <h3 className="font-black text-black uppercase tracking-widest">{editingId ? 'Editar' : 'Agregar'} Usuario</h3>
                <div className="flex space-x-3">
                  <button 
                    onClick={() => { setIsAdding(false); setEditingId(null); resetUserForm(); }}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={handleSaveUser}
                    className="px-6 py-2 bg-black text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 shadow-lg"
                  >
                    Guardar
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nombre Completo</label>
                  <input 
                    type="text" value={useFormName} onChange={e => setUserFormName(e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-600 outline-none"
                    placeholder="Ej. Juan Pérez"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">PIN (4 dígitos)</label>
                  <input 
                    type="password" maxLength={4} value={userFormPin} onChange={e => setUserFormPin(e.target.value.replace(/\D/g, ''))}
                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-600 outline-none"
                    placeholder="****"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rol / Permisos</label>
                  <select 
                    value={userFormRole} onChange={e => setUserFormRole(e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-600 outline-none"
                  >
                    {roles.map(role => (
                      <option key={role.name} value={role.name}>{role.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
            <table className="w-full text-left min-w-[500px] md:min-w-0">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Nombre</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Rol</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">PIN</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {users.map(user => (
                  <tr key={user.id} className="hover:bg-red-50/30 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-900">{user.name}</td>
                    <td className="px-6 py-4">
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded border uppercase ${
                        user.role === 'Admin' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-slate-600 border-slate-300'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-400">****</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end space-x-1">
                        <button onClick={() => startEditUser(user)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"><Icons.Edit /></button>
                        <button 
                          onClick={() => deleteUser(user.id)} 
                          className={`p-2 transition rounded-lg ${user.id === 'admin' ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-black hover:bg-slate-100'}`}
                          disabled={user.id === 'admin'}
                        >
                          <Icons.Trash />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'shifts' && (
        <>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Historial de Turnos</h2>
            <div className="bg-slate-100 px-3 py-1.5 rounded-lg text-[10px] font-black text-slate-500 uppercase tracking-widest">
              {shifts.length} Registros
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Usuario</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Entrada</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Salida</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Duración</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {shifts.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-center text-slate-400 uppercase text-xs font-black tracking-widest">No hay turnos registrados</td>
                  </tr>
                ) : (
                  shifts.map(shift => {
                    const start = new Date(shift.startTime);
                    const end = shift.endTime ? new Date(shift.endTime) : null;
                    const duration = end ? Math.round((end.getTime() - start.getTime()) / 60000) : null;

                    return (
                      <tr key={shift.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-900">{shift.userName}</td>
                        <td className="px-6 py-4 text-xs">
                          {start.toLocaleDateString()} {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-6 py-4 text-xs">
                          {end ? (
                            `${end.toLocaleDateString()} ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                          ) : (
                            <span className="text-green-500 font-black animate-pulse uppercase text-[10px]">En Turno</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-xs font-bold text-slate-600">
                          {duration !== null ? `${Math.floor(duration/60)}h ${duration%60}m` : '-'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'roles' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Configuración de Roles</h2>
            {!isAdding && !editingId && (
              <button 
                onClick={() => {
                  setEditingId(null);
                  setIsAdding(true);
                  setRoleFormName('');
                  setRoleFormPermissions([]);
                }}
                className="bg-black text-white px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest flex items-center space-x-2 hover:bg-slate-800 transition shadow-lg"
              >
                <Icons.Plus /> <span>Nuevo Rol</span>
              </button>
            )}
          </div>

          {(isAdding || editingId) && (
            <div className="bg-white p-8 rounded-3xl border-2 border-black shadow-2xl space-y-6 animate-in zoom-in duration-200">
              <div className="flex justify-between items-center border-b pb-6">
                <h3 className="text-lg font-black uppercase tracking-widest">{editingId ? 'Editar' : 'Crear'} Rol</h3>
                <div className="flex space-x-3">
                  <button 
                    onClick={() => { setIsAdding(false); setEditingId(null); }}
                    className="px-4 py-2 bg-slate-100 text-slate-500 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={handleSaveRole}
                    className="px-6 py-2 bg-black text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-red-600 shadow-xl transition-all"
                  >
                    Guardar
                  </button>
                </div>
              </div>
              
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nombre del Rol</label>
                <input 
                  type="text"
                  value={roleFormName}
                  onChange={e => setRoleFormName(e.target.value)}
                  className="w-full p-4 rounded-2xl bg-slate-50 border-0 ring-1 ring-slate-200 focus:ring-2 focus:ring-black outline-none font-bold"
                  placeholder="Ej. Supervisor de Barra"
                />
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Permisos de Visualización</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {availableViews.map(view => (
                    <button
                      key={view.id}
                      type="button"
                      onClick={() => togglePermission(view.id)}
                      className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${
                        roleFormPermissions.includes(view.id)
                          ? 'border-red-600 bg-red-50 text-red-900 shadow-md'
                          : 'border-slate-100 bg-slate-50 text-slate-400 opacity-60'
                      }`}
                    >
                      <span className="font-black text-[10px] uppercase tracking-widest">{view.label}</span>
                      {roleFormPermissions.includes(view.id) ? (
                        <Icons.CheckCircle size={20} className="text-red-600" />
                      ) : (
                        <div className="w-5 h-5 rounded-full border-2 border-slate-200" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {roles.map(role => (
              <div key={role.name} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between group transition-all hover:border-black">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-xl font-black text-slate-900 uppercase tracking-tighter">{role.name}</h4>
                    <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => {
                          setEditingId(role.name);
                          setRoleFormName(role.name);
                          setRoleFormPermissions(role.permissions);
                          setIsAdding(false);
                        }}
                        className="p-2 text-slate-400 hover:text-black hover:bg-slate-100 rounded-xl"
                      >
                        <Icons.Edit />
                      </button>
                      <button 
                        onClick={() => deleteRole(role.name)}
                        className={`p-2 rounded-xl transition ${role.name === 'Admin' ? 'text-slate-100 cursor-not-allowed' : 'text-slate-400 hover:text-red-600 hover:bg-red-50'}`}
                        disabled={role.name === 'Admin'}
                      >
                        <Icons.Trash />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {role.permissions.map(p => (
                      <span key={p} className="px-2 py-1 bg-slate-100 text-slate-500 text-[9px] font-black uppercase tracking-widest rounded-lg border border-slate-200">
                        {availableViews.find(v => v.id === p)?.label || p}
                      </span>
                    ))}
                    {role.permissions.length === 0 && (
                      <span className="text-[10px] font-bold text-slate-300 italic">Sin accesos</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {activeTab === 'general' && (
        <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-400 pb-10">
          <div className="space-y-6">
            <div className="flex justify-between items-center sticky top-0 bg-slate-50 z-20 py-4 -mt-4 mb-2">
              <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Ajustes del Negocio</h2>
              <button 
                onClick={handleSaveGeneral}
                className="bg-black text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-slate-800 transition shadow-xl"
              >
                Guardar Cambios
              </button>
            </div>
            
            {/* Perfil del Negocio */}
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
              <h3 className="text-sm font-black text-black uppercase tracking-widest border-b border-slate-100 pb-4">Perfil del Negocio</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nombre del Negocio</label>
                  <div className="relative">
                    <div className="absolute left-3 top-3 text-slate-400"><Icons.ChefHat size={18}/></div>
                    <input 
                      type="text" 
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-50 border-0 ring-1 ring-slate-200 focus:ring-2 focus:ring-black outline-none font-bold text-slate-800 text-sm"
                      value={formSettings.name}
                      onChange={e => setFormSettings({...formSettings, name: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Giro / Rubro Comercial</label>
                  <div className="relative">
                    <div className="absolute left-3 top-3 text-slate-400"><Icons.MapPin size={18}/></div>
                    <input 
                      type="text" 
                      placeholder="Ej. Restaurante, Cafetería, Bar..."
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-50 border-0 ring-1 ring-slate-200 focus:ring-2 focus:ring-black outline-none font-bold text-slate-800 text-sm"
                      value={formSettings.eventType}
                      onChange={e => setFormSettings({...formSettings, eventType: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha de Operación (Hoy)</label>
                  <div className="relative">
                    <div className="absolute left-3 top-3 text-red-600"><Icons.Calendar size={18}/></div>
                    <div className="w-full pl-10 pr-4 py-3 rounded-xl bg-red-50 border-0 ring-1 ring-red-100 font-black text-red-600 text-sm uppercase">
                      {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Teléfono</label>
                  <input 
                    type="text" 
                    placeholder="Ej. +52 123 456 7890"
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-0 ring-1 ring-slate-200 focus:ring-2 focus:ring-black outline-none font-bold text-slate-800 text-sm"
                    value={formSettings.phone || ''}
                    onChange={e => setFormSettings({...formSettings, phone: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Correo Electrónico</label>
                  <input 
                    type="email" 
                    placeholder="contacto@minegocio.com"
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-0 ring-1 ring-slate-200 focus:ring-2 focus:ring-black outline-none font-bold text-slate-800 text-sm"
                    value={formSettings.email || ''}
                    onChange={e => setFormSettings({...formSettings, email: e.target.value})}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dirección Comercial</label>
                  <input 
                    type="text" 
                    placeholder="Av. Principal 123, Ciudad, País"
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-0 ring-1 ring-slate-200 focus:ring-2 focus:ring-black outline-none font-bold text-slate-800 text-sm"
                    value={formSettings.address || ''}
                    onChange={e => setFormSettings({...formSettings, address: e.target.value})}
                  />
                </div>
              </div>
            </div>

            {/* Configuración de Tickets */}
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
              <h3 className="text-sm font-black text-black uppercase tracking-widest border-b border-slate-100 pb-4">Tickets & Recibos</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Moneda</label>
                  <select 
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-0 ring-1 ring-slate-200 focus:ring-2 focus:ring-black outline-none font-bold text-slate-800 text-sm appearance-none"
                    value={formSettings.currency}
                    onChange={e => setFormSettings({...formSettings, currency: e.target.value})}
                  >
                    <option value="MXN">Peso Mexicano (MXN)</option>
                    <option value="USD">Dólar Estadounidense (USD)</option>
                    <option value="EUR">Euro (EUR)</option>
                    <option value="ARS">Peso Argentino (ARS)</option>
                    <option value="COP">Peso Colombiano (COP)</option>
                    <option value="PEN">Sol Peruano (PEN)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Identificador Fiscal / RFC / RUT</label>
                  <input 
                    type="text" 
                    placeholder="Opcional"
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-0 ring-1 ring-slate-200 focus:ring-2 focus:ring-black outline-none font-bold text-slate-800 text-sm"
                    value={formSettings.taxId || ''}
                    onChange={e => setFormSettings({...formSettings, taxId: e.target.value})}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mensaje Impreso - Cabecera</label>
                  <textarea 
                    placeholder="Ej. ¡Bienvenidos a nuestro local! / Wi-Fi: ... "
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-0 ring-1 ring-slate-200 focus:ring-2 focus:ring-black outline-none font-bold text-slate-800 text-sm resize-none h-20"
                    value={formSettings.receiptHeader || ''}
                    onChange={e => setFormSettings({...formSettings, receiptHeader: e.target.value})}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mensaje Impreso - Pie de Página</label>
                  <textarea 
                    placeholder="Ej. ¡Gracias por su preferencia! / Síganos en redes: @minegocio"
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-0 ring-1 ring-slate-200 focus:ring-2 focus:ring-black outline-none font-bold text-slate-800 text-sm resize-none h-20"
                    value={formSettings.receiptFooter || ''}
                    onChange={e => setFormSettings({...formSettings, receiptFooter: e.target.value})}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Respaldo de Base de Datos</h2>
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <button 
                  onClick={handleExportData}
                  className="flex-1 bg-black text-white px-6 py-6 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-slate-900 transition shadow-xl flex flex-col items-center justify-center space-y-3"
                >
                  <div className="scale-150 mb-1"><Icons.FileText /></div>
                  <span>Exportar Base de Datos</span>
                </button>

                <div className="flex-1 relative">
                  <input 
                    type="file" 
                    accept=".json" 
                    onChange={handleFileSelect} 
                    className="hidden" 
                    ref={backupFileInputRef}
                  />
                  <button 
                    onClick={() => backupFileInputRef.current?.click()}
                    className="w-full h-full bg-slate-100 text-slate-700 px-6 py-6 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-slate-200 transition border-2 border-dashed border-slate-300 flex flex-col items-center justify-center space-y-3"
                  >
                    <div className="scale-150 mb-1 rotate-180"><Icons.FileText /></div>
                    <span>Seleccionar Archivo</span>
                  </button>
                </div>
              </div>

              {/* PREVIEW AREA */}
              {preview && (
                <div className="mt-6 bg-slate-50 rounded-3xl border-2 border-red-600 p-6 animate-in zoom-in duration-300">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-black text-black uppercase tracking-widest text-xs">Previsualización del Respaldo</h4>
                    <button onClick={() => setPreview(null)} className="text-slate-400 hover:text-red-600 transition"><Icons.Trash /></button>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white p-3 rounded-xl border border-slate-200">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Archivo</p>
                      <p className="text-[10px] font-bold truncate">{preview.fileName}</p>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-slate-200">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Productos</p>
                      <p className="text-lg font-black">{preview.products.length}</p>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-slate-200">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Mesas</p>
                      <p className="text-lg font-black">{preview.tables.length}</p>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-slate-200">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Categorías</p>
                      <p className="text-lg font-black">{preview.categories.length}</p>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-slate-200">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Órdenes</p>
                      <p className="text-lg font-black">{preview.orders.length}</p>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-slate-200">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Usuarios</p>
                      <p className="text-lg font-black">{preview.users.length}</p>
                    </div>
                  </div>

                  <div className="p-4 bg-white rounded-xl border border-slate-200 mb-6">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Ajustes a aplicar:</p>
                    <p className="text-[10px] font-black uppercase tracking-tight text-red-600">{preview.settings.name} / {preview.settings.eventType}</p>
                  </div>

                  <button 
                    onClick={applyBackup}
                    className="w-full bg-red-600 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-[0.2em] flex items-center justify-center space-x-3 shadow-2xl shadow-red-200 hover:bg-red-700 transition"
                  >
                    <Icons.CheckCircle />
                    <span>APLICAR ESTE RESPALDO</span>
                  </button>
                </div>
              )}
              
              <div className="p-4 bg-red-50 rounded-2xl border border-red-100 flex items-start space-x-3">
                <div className="text-red-600 pt-0.5 scale-90"><Icons.Settings /></div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase text-red-800 tracking-wider">¡Atención!</p>
                  <p className="text-[10px] text-red-700 leading-relaxed font-medium">
                    Use estas funciones para guardar su progreso. El sistema almacena datos localmente, por lo que limpiar la caché del navegador borrará su información si no tiene un respaldo.
                  </p>
                </div>
              </div>
            </div>

            {/* Zona de Peligro - Factory Reset */}
            <div className="bg-red-50 p-8 rounded-3xl border-2 border-dashed border-red-200 mt-6">
              <div className="flex items-center space-x-3 text-red-600 mb-6">
                <Icons.Activity size={24} />
                <h3 className="text-sm font-black uppercase tracking-widest">Zona de Peligro</h3>
              </div>
              
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-1">
                  <p className="text-sm font-black text-slate-900 uppercase">Reiniciar Aplicación (Modo Fábrica)</p>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight max-w-sm">Borra absolutamente todo. Tras el reinicio, el sistema te pedirá configurar un nuevo Administrador Maestro.</p>
                </div>
                
                <div className="shrink-0">
                  {resetStep === 0 ? (
                    <button 
                      onClick={() => setResetStep(1)}
                      className="bg-red-600 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-red-700 transition shadow-lg"
                    >
                      Limpiar Todo
                    </button>
                  ) : resetStep === 1 ? (
                    <div className="flex flex-col items-end space-y-2">
                      <p className="text-[10px] font-black text-red-600 uppercase animate-pulse">¿Confirmas que deseas BORRAR TODO?</p>
                      <div className="flex space-x-2">
                        <button 
                          onClick={() => setResetStep(0)}
                          className="px-3 py-1.5 bg-slate-200 text-slate-600 rounded-lg font-black text-[10px] uppercase"
                        >
                          No
                        </button>
                        <button 
                          onClick={() => setResetStep(2)}
                          className="px-3 py-1.5 bg-red-600 text-white rounded-lg font-black text-[10px] uppercase hover:bg-red-700"
                        >
                          Sí, Estoy Seguro
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-end space-y-2">
                      <p className="text-[10px] font-black text-slate-900 uppercase">PIN de Administrador</p>
                      <div className="flex space-x-2">
                        <input 
                          type="password" 
                          maxLength={4}
                          placeholder="••••"
                          className="w-20 px-2 py-1.5 rounded-lg bg-white border-2 border-red-200 focus:border-red-600 outline-none font-black text-center tracking-[0.3em]"
                          value={resetPin}
                          onChange={(e) => {
                            setResetPin(e.target.value);
                            setResetError('');
                          }}
                        />
                        <button 
                          onClick={() => setResetStep(0)}
                          className="px-3 py-1.5 bg-slate-200 text-slate-600 rounded-lg font-black text-[10px] uppercase"
                        >
                          X
                        </button>
                        <button 
                          onClick={handleFactoryReset}
                          className="px-4 py-1.5 bg-red-600 text-white rounded-lg font-black text-[10px] uppercase hover:bg-red-800 shadow-lg"
                        >
                          BORRAR
                        </button>
                      </div>
                      {resetError && <p className="text-[9px] font-black text-red-600 uppercase">{resetError}</p>}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <ConfirmationModal 
        isOpen={confirmState.isOpen}
        onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmState.onConfirm}
        title={confirmState.title}
        message={confirmState.message}
        type={confirmState.type as 'danger' | 'warning'}
      />
    </div>
  );
};

export default ProductManagement;
