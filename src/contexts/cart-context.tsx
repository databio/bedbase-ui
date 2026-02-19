import { createContext, useContext, useState, type ReactNode } from 'react';

export type CartItem = {
  id: string;
  name: string;
  genome: string;
};

type CartContextValue = {
  cart: Record<string, CartItem>;
  addToCart: (item: CartItem) => void;
  removeFromCart: (id: string) => void;
  isInCart: (id: string) => boolean;
  cartCount: number;
};

const STORAGE_KEY = 'bedbase-cart';

function loadCart(): Record<string, CartItem> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveCart(cart: Record<string, CartItem>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState(loadCart);

  const addToCart = (item: CartItem) => {
    setCart((prev) => {
      const next = { ...prev, [item.id]: item };
      saveCart(next);
      return next;
    });
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => {
      const next = { ...prev };
      delete next[id];
      saveCart(next);
      return next;
    });
  };

  const isInCart = (id: string) => id in cart;
  const cartCount = Object.keys(cart).length;

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, isInCart, cartCount }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
}
