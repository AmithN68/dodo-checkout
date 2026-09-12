import heroImage from "../assets/hero.png";

export interface Product {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  currency: string;
  image: string;
}

export const PRODUCTS: Record<string, Product> = {
  prod_123: {
    id: "prod_123",
    name: "Desk Lamp",
    description: "Warm-dimming LED lamp with a walnut base.",
    priceCents: 4900,
    currency: "INR",
    image: heroImage,
  },
  prod_456: {
    id: "prod_456",
    name: "Desk Lamp — Pro",
    description: "Desk Lamp with wireless charging base.",
    priceCents: 7900,
    currency: "INR",
    image: heroImage,
  },
};

export const getProduct = (productId: string): Product | undefined => {
  return PRODUCTS[productId];
};

export const formatPrice = (priceCents: number, currency: string): string => {
  const amount = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(priceCents / 100);

  return currency === "INR" ? `Rs ${amount}` : `${currency} ${amount}`;
};
