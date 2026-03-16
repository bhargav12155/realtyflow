import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { getAuthHeaders } from "@/lib/authToken";
import { useBusinessType } from "@/lib/businessContext";
import { MenuItem } from "@shared/schema";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Tag,
  DollarSign,
  Star,
  Package,
  UtensilsCrossed,
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  sold_out: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  discontinued: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  seasonal: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
};

const AVAILABILITY_OPTIONS = [
  { value: "always", label: "Always Available" },
  { value: "seasonal", label: "Seasonal" },
  { value: "limited", label: "Limited Time" },
  { value: "weekends_only", label: "Weekends Only" },
];

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "sold_out", label: "Sold Out" },
  { value: "seasonal", label: "Seasonal" },
  { value: "discontinued", label: "Discontinued" },
];

function MenuItemForm({
  item,
  onSave,
  onCancel,
}: {
  item?: MenuItem | null;
  onSave: (data: any) => void;
  onCancel: () => void;
}) {
  const { terms, businessType } = useBusinessType();
  const [form, setForm] = useState({
    name: item?.name || "",
    category: item?.category || "",
    description: item?.description || "",
    price: item?.price ? String(item.price / 100) : "",
    availability: item?.availability || "always",
    status: item?.status || "active",
    isSpecial: item?.isSpecial || false,
    specialPrice: item?.specialPrice ? String(item.specialPrice / 100) : "",
    tags: item?.tags?.join(", ") || "",
    ingredients: item?.ingredients?.join(", ") || "",
    dietaryTags: item?.dietaryTags?.join(", ") || "",
    allergens: item?.allergens?.join(", ") || "",
    notes: item?.notes || "",
  });

  const isRestaurant = businessType === "restaurant";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name: form.name,
      category: form.category || null,
      description: form.description || null,
      price: form.price ? Math.round(parseFloat(form.price) * 100) : null,
      availability: form.availability,
      status: form.status,
      isSpecial: form.isSpecial,
      specialPrice: form.specialPrice ? Math.round(parseFloat(form.specialPrice) * 100) : null,
      tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : null,
      ingredients: isRestaurant && form.ingredients
        ? form.ingredients.split(",").map((t) => t.trim()).filter(Boolean)
        : null,
      dietaryTags: isRestaurant && form.dietaryTags
        ? form.dietaryTags.split(",").map((t) => t.trim()).filter(Boolean)
        : null,
      allergens: isRestaurant && form.allergens
        ? form.allergens.split(",").map((t) => t.trim()).filter(Boolean)
        : null,
      notes: form.notes || null,
      businessType,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label htmlFor="name">Name *</Label>
          <Input
            id="name"
            data-testid="input-item-name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder={
              isRestaurant
                ? "e.g., Margherita Pizza"
                : businessType === "retail"
                ? "e.g., Classic White T-Shirt"
                : businessType === "real_estate"
                ? "e.g., 4BR Colonial in Elkhorn"
                : "e.g., Drain Cleaning Service"
            }
            required
          />
        </div>
        <div>
          <Label htmlFor="category">Category</Label>
          <Input
            id="category"
            data-testid="input-item-category"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            placeholder={
              isRestaurant
                ? "e.g., Pizza, Pasta, Desserts"
                : businessType === "real_estate"
                ? "e.g., Single Family, Condo, Land"
                : businessType === "retail"
                ? "e.g., Tops, Bottoms, Accessories"
                : "e.g., Plumbing, HVAC"
            }
          />
        </div>
        <div>
          <Label htmlFor="price">Price ($)</Label>
          <Input
            id="price"
            data-testid="input-item-price"
            type="number"
            step="0.01"
            min="0"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            placeholder="0.00"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          data-testid="input-item-description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder={
            isRestaurant
              ? "Fresh mozzarella, tomato sauce, basil leaves..."
              : businessType === "real_estate"
              ? "e.g., Stunning walkout ranch with open floor plan, 3-car garage, and modern finishes..."
              : "Describe this item..."
          }
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Availability</Label>
          <Select
            value={form.availability}
            onValueChange={(v) => setForm({ ...form, availability: v })}
          >
            <SelectTrigger data-testid="select-availability">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AVAILABILITY_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Status</Label>
          <Select
            value={form.status}
            onValueChange={(v) => setForm({ ...form, status: v })}
          >
            <SelectTrigger data-testid="select-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Switch
            id="isSpecial"
            data-testid="switch-special"
            checked={form.isSpecial}
            onCheckedChange={(v) => setForm({ ...form, isSpecial: v })}
          />
          <Label htmlFor="isSpecial">Mark as Special / Featured</Label>
        </div>
      </div>

      {form.isSpecial && (
        <div>
          <Label htmlFor="specialPrice">Special Price ($)</Label>
          <Input
            id="specialPrice"
            data-testid="input-special-price"
            type="number"
            step="0.01"
            min="0"
            value={form.specialPrice}
            onChange={(e) => setForm({ ...form, specialPrice: e.target.value })}
            placeholder="0.00"
          />
        </div>
      )}

      {isRestaurant && (
        <>
          <div>
            <Label htmlFor="ingredients">Ingredients (comma-separated)</Label>
            <Input
              id="ingredients"
              data-testid="input-ingredients"
              value={form.ingredients}
              onChange={(e) => setForm({ ...form, ingredients: e.target.value })}
              placeholder="Mozzarella, tomato sauce, fresh basil..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="dietaryTags">Dietary Tags</Label>
              <Input
                id="dietaryTags"
                data-testid="input-dietary"
                value={form.dietaryTags}
                onChange={(e) => setForm({ ...form, dietaryTags: e.target.value })}
                placeholder="vegetarian, vegan, gluten-free..."
              />
            </div>
            <div>
              <Label htmlFor="allergens">Allergens</Label>
              <Input
                id="allergens"
                data-testid="input-allergens"
                value={form.allergens}
                onChange={(e) => setForm({ ...form, allergens: e.target.value })}
                placeholder="dairy, nuts, shellfish..."
              />
            </div>
          </div>
        </>
      )}

      <div>
        <Label htmlFor="tags">Tags (comma-separated)</Label>
        <Input
          id="tags"
          data-testid="input-tags"
          value={form.tags}
          onChange={(e) => setForm({ ...form, tags: e.target.value })}
          placeholder={isRestaurant ? "bestseller, house-special, new..." : "popular, featured, new..."}
        />
      </div>

      <div>
        <Label htmlFor="notes">Internal Notes</Label>
        <Textarea
          id="notes"
          data-testid="input-notes"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          rows={2}
          placeholder="Notes for your team only..."
        />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" data-testid="button-save-item">
          {item ? "Save Changes" : `Add ${terms.itemCapitalized}`}
        </Button>
      </DialogFooter>
    </form>
  );
}

export default function MenuItemsPage() {
  const { terms, businessType } = useBusinessType();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const { data: items = [], isLoading } = useQuery<MenuItem[]>({
    queryKey: ["/api/menu-items", businessType],
    queryFn: async () => {
      const res = await fetch(`/api/menu-items?businessType=${encodeURIComponent(businessType)}`, {
        credentials: "include",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/menu-items", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/menu-items", businessType] });
      setDialogOpen(false);
      toast({ title: `${terms.itemCapitalized} added!` });
    },
    onError: () => {
      toast({ title: "Failed to add item", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest("PATCH", `/api/menu-items/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/menu-items", businessType] });
      setDialogOpen(false);
      setEditingItem(null);
      toast({ title: `${terms.itemCapitalized} updated!` });
    },
    onError: () => {
      toast({ title: "Failed to update item", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/menu-items/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/menu-items", businessType] });
      toast({ title: `${terms.itemCapitalized} deleted` });
    },
    onError: () => {
      toast({ title: "Failed to delete item", variant: "destructive" });
    },
  });

  const handleSave = (data: any) => {
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data });
    } else {
      createMutation.mutate({ ...data, businessType });
    }
  };

  const openNew = () => {
    setEditingItem(null);
    setDialogOpen(true);
  };

  const openEdit = (item: MenuItem) => {
    setEditingItem(item);
    setDialogOpen(true);
  };

  const categories = ["all", ...Array.from(new Set(items.map((i) => i.category).filter(Boolean) as string[]))];

  const filtered = items.filter((item) => {
    const matchesSearch =
      !search ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.description?.toLowerCase().includes(search.toLowerCase()) ||
      item.category?.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = filterCategory === "all" || item.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const specialCount = items.filter((i) => i.isSpecial).length;
  const activeCount = items.filter((i) => i.status === "active").length;

  const businessIcon =
    businessType === "restaurant" ? (
      <UtensilsCrossed className="w-6 h-6 text-amber-500" />
    ) : (
      <Package className="w-6 h-6 text-amber-500" />
    );

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar activeView="menu-items" />
      <main className="flex-1 overflow-y-auto">
        <div className="container mx-auto py-8 px-6 max-w-7xl">
          {/* Header */}
          <div className="flex items-start justify-between mb-8">
            <div className="flex items-center gap-3">
              {businessIcon}
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  {terms.catalogPage}
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1">
                  {terms.catalogDescription}
                </p>
              </div>
            </div>
            <Button
              onClick={openNew}
              data-testid="button-add-item"
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              {terms.addItem}
            </Button>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="py-4">
                <div className="text-2xl font-bold">{items.length}</div>
                <div className="text-sm text-gray-500">Total {terms.items}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <div className="text-2xl font-bold text-green-600">{activeCount}</div>
                <div className="text-sm text-gray-500">Active</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <div className="text-2xl font-bold text-amber-500">{specialCount}</div>
                <div className="text-sm text-gray-500">Featured / Special</div>
              </CardContent>
            </Card>
          </div>

          {/* Search and filters */}
          <div className="flex gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                data-testid="input-search"
                className="pl-9"
                placeholder={terms.searchItem}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {categories.length > 1 && (
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-48" data-testid="select-filter-category">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c === "all" ? "All Categories" : c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Items grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-4 h-32 bg-gray-200 dark:bg-gray-700 rounded" />
                </Card>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              {businessType === "restaurant" ? (
                <UtensilsCrossed className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              ) : (
                <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              )}
              <p className="text-gray-500 text-lg">
                {items.length === 0
                  ? `No ${terms.items} yet. Add your first one!`
                  : `No ${terms.items} match your search.`}
              </p>
              {items.length === 0 && (
                <Button onClick={openNew} className="mt-4 bg-amber-500 hover:bg-amber-600 text-white">
                  <Plus className="w-4 h-4 mr-2" />
                  {terms.addItem}
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((item) => (
                <Card
                  key={item.id}
                  data-testid={`card-item-${item.id}`}
                  className="hover:shadow-md transition-shadow"
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base font-semibold line-clamp-1">
                            {item.name}
                          </CardTitle>
                          {item.isSpecial && (
                            <Star className="w-4 h-4 text-amber-500 flex-shrink-0 fill-amber-500" />
                          )}
                        </div>
                        {item.category && (
                          <p className="text-xs text-gray-500 mt-0.5">{item.category}</p>
                        )}
                      </div>
                      <div className="flex gap-1 ml-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          data-testid={`button-edit-${item.id}`}
                          onClick={() => openEdit(item)}
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-red-500 hover:text-red-600"
                          data-testid={`button-delete-${item.id}`}
                          onClick={() => deleteMutation.mutate(item.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {item.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">
                        {item.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {item.price != null && (
                          <div className="flex items-center gap-1 text-sm font-medium">
                            <DollarSign className="w-3 h-3" />
                            {(item.price / 100).toFixed(2)}
                          </div>
                        )}
                        {item.isSpecial && item.specialPrice != null && (
                          <div className="flex items-center gap-1 text-sm font-medium text-amber-600">
                            <Tag className="w-3 h-3" />
                            {(item.specialPrice / 100).toFixed(2)}
                          </div>
                        )}
                      </div>
                      <Badge
                        className={
                          STATUS_COLORS[item.status || "active"] ||
                          STATUS_COLORS.active
                        }
                        variant="outline"
                      >
                        {item.status || "active"}
                      </Badge>
                    </div>
                    {item.tags && item.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {item.tags.slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {businessType === "restaurant" && item.dietaryTags && item.dietaryTags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {item.dietaryTags.map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs text-green-600 border-green-300">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? terms.editItem : terms.addItem}
            </DialogTitle>
          </DialogHeader>
          <MenuItemForm
            item={editingItem}
            onSave={handleSave}
            onCancel={() => {
              setDialogOpen(false);
              setEditingItem(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
