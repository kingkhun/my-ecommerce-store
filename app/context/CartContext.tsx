'use client';
import React, { createContext, useContext, useState, useEffect } from 'react';

// Use your existing interfaces
interface CartItem {
  id: string;
  name: string;
  price: number;
  image_url: string;
  SoldQuantity: number;
  stock_quantity: number;
}

interface CartContextType {
  cart: CartItem[];
  addToCart: (product: any) => void;
  removeFromCart: (index: number) => void;
  clearCart: () => void;
  totalPrice: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);

  // Your existing localStorage logic
  useEffect(() => {
    const saved = localStorage.getItem('my_ecommerce_cart');
    if (saved) setCart(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem('my_ecommerce_cart', JSON.stringify(cart));
  }, [cart]);

  // Your existing total calculation
  const totalPrice = cart.reduce((sum, item) => sum + item.price * (item.SoldQuantity || 1), 0);

  // Your existing addToCart logic
  const addToCart = (product: any) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        if (existing.SoldQuantity + 1 > product.stock_quantity) {
          alert("Out of stock!");
          return prev;
        }
        return prev.map((item) =>
          item.id === product.id ? { ...item, SoldQuantity: item.SoldQuantity + 1 } : item
        );
      }
      return [...prev, { ...product, SoldQuantity: 1 }];
    });
  };

  const removeFromCart = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const clearCart = () => {
    setCart([]);
    localStorage.removeItem('my_ecommerce_cart');
  };

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, clearCart, totalPrice }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider");
  return context;
};