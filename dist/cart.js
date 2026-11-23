const cartKey = 'tsu-cart';

function savedCart() {
  try {
    const value = JSON.parse(localStorage.getItem(cartKey));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function createCart(products, onUpdate) {
  const items = [];
  const available = new Map(products.map(product=>[product.id,product]));
  function add(id, variantId, quantity) {
    const variant = available.get(id)?.variants.find(option=>option.id===variantId);
    if (!variant || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 20) return false;
    const existing = items.find(item=>item.id===id && item.variantId===variantId);
    if (existing) existing.quantity = Math.min(20,existing.quantity+quantity);
    else items.push({id,variantId,quantity});
    return true;
  }
  for (const row of savedCart()) {
    if (row) add(row.id,row.variantId ?? row.size,row.quantity);
  }
  function save() {
    try { localStorage.setItem(cartKey,JSON.stringify(items)); } catch {}
    onUpdate(items.reduce((sum,item)=>sum+item.quantity,0));
  }
  save();
  return {
    items,
    product: id=>available.get(id),
    add(id,variantId,quantity) {
      if (!add(id,variantId,quantity)) return false;
      save();
      return true;
    },
    change(index,delta) {
      const item = items[index];
      if (!item) return;
      item.quantity = Math.min(20,item.quantity+delta);
      if (!item.quantity) items.splice(index,1);
      save();
    }
  };
}
