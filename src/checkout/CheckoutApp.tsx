import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import { formatPrice, getProduct } from "../data/products";
import { processPayment } from "../services/fakePayment";
import type { CheckoutInitMessage } from "../types/checkout";

import "./checkout.css";

const createCheckoutId = (): string => {
  return `checkout_${crypto.randomUUID()}`;
};

const formatCardNumber = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 16);
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
};

const formatExpiry = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 4);

  if (digits.length <= 2) {
    return digits;
  }

  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const isValidEmail = (value: string): boolean => {
  return EMAIL_PATTERN.test(value.trim());
};

const isValidCardNumber = (digitsOnly: string): boolean => {
  if (digitsOnly.length !== 16) {
    return false;
  }

  let sum = 0;
  let shouldDouble = false;

  for (let i = digitsOnly.length - 1; i >= 0; i--) {
    let digit = Number(digitsOnly[i]);

    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }

    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
};

const isValidExpiry = (expiry: string): boolean => {
  const match = /^(\d{2})\/(\d{2})$/.exec(expiry);

  if (!match) {
    return false;
  }

  const month = Number(match[1]);
  const year = Number(match[2]);

  if (month < 1 || month > 12) {
    return false;
  }

  const currentDate = new Date();
  const currentYear = currentDate.getFullYear() % 100;
  const currentMonth = currentDate.getMonth() + 1;

  if (year < currentYear) {
    return false;
  }

  if (year === currentYear && month < currentMonth) {
    return false;
  }

  return true;
};

const SUCCESS_DISPLAY_MS = 1300;

const postToParent = (message: Record<string, unknown>, targetOrigin: string): void => {
  window.parent.postMessage(message, targetOrigin);
};

const CheckoutApp = () => {
  const [checkoutId, setCheckoutId] = useState("");
  const [productId, setProductId] = useState("");
  const [initialized, setInitialized] = useState(false);

  const [email, setEmail] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");

  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSuccessful, setIsSuccessful] = useState(false);

  const emailInputRef = useRef<HTMLInputElement>(null);
  const parentOriginRef = useRef<string>(window.location.origin);

  useEffect(() => {
    const isStandaloneCheckout = window.parent === window;

    if (isStandaloneCheckout) {
      setCheckoutId(createCheckoutId());
      setProductId("prod_123");
      setInitialized(true);
      return;
    }

    const handleMessage = (event: MessageEvent): void => {
      if (event.source !== window.parent) {
        return;
      }

      const message = event.data as Partial<CheckoutInitMessage>;

      if (
        message.type !== "DODO_CHECKOUT_INIT" ||
        typeof message.checkoutId !== "string" ||
        typeof message.productId !== "string"
      ) {
        return;
      }

      parentOriginRef.current = event.origin;

      setCheckoutId(message.checkoutId);
      setProductId(message.productId);
      setInitialized(true);
    };

    window.addEventListener("message", handleMessage);
    window.parent.postMessage({ type: "DODO_CHECKOUT_READY" }, "*");

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  const successSessionIdRef = useRef<string>("");

  useEffect(() => {
    emailInputRef.current?.focus();
  }, [initialized]);

  useEffect(() => {
    postToParent({ type: "DODO_CHECKOUT_PROCESSING", isProcessing }, parentOriginRef.current);
  }, [isProcessing]);

  useEffect(() => {
    if (!isSuccessful) {
      return;
    }

    const timeoutId = setTimeout(() => {
      postToParent(
        { type: "DODO_CHECKOUT_SUCCESS", sessionId: successSessionIdRef.current },
        parentOriginRef.current,
      );
    }, SUCCESS_DISPLAY_MS);

    return () => clearTimeout(timeoutId);
  }, [isSuccessful]);

  const requestClose = (): void => {
    if (isProcessing) {
      return;
    }

    postToParent({ type: "DODO_CHECKOUT_CLOSE", reason: "user" }, parentOriginRef.current);
  };

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        requestClose();
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isProcessing]);

  const handleCardNumberChange = (value: string): void => {
    setCardNumber(formatCardNumber(value));
    if (errorMessage) setErrorMessage("");
  };

  const handleExpiryChange = (value: string): void => {
    setExpiry(formatExpiry(value));
    if (errorMessage) setErrorMessage("");
  };

  const handleCvcChange = (value: string): void => {
    const digits = value.replace(/\D/g, "").slice(0, 3);
    setCvc(digits);
    if (errorMessage) setErrorMessage("");
  };

  const validateForm = (): string | null => {
    if (!email.trim()) {
      return "Enter your email address.";
    }

    if (!isValidEmail(email)) {
      return "Enter a valid email address.";
    }

    const normalizedCardNumber = cardNumber.replace(/\s/g, "");

    if (normalizedCardNumber.length !== 16) {
      return "Enter a valid 16-digit card number.";
    }

    if (!isValidCardNumber(normalizedCardNumber)) {
      return "That card number doesn't look right. Check the digits and try again.";
    }

    if (!isValidExpiry(expiry)) {
      return "Enter a valid expiry date.";
    }

    if (cvc.length !== 3) {
      return "Enter a valid 3-digit CVC.";
    }

    if (!checkoutId) {
      return "Checkout is not ready. Please try again.";
    }

    return null;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    if (isProcessing || isSuccessful) {
      return;
    }

    const validationError = validateForm();

    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setErrorMessage("");
    setIsProcessing(true);

    const result = await processPayment(cardNumber, checkoutId);

    setIsProcessing(false);

    if (result.status === "error") {
      setErrorMessage(result.message);
      postToParent(
        { type: "DODO_CHECKOUT_ERROR", code: result.code, message: result.message },
        parentOriginRef.current,
      );
      return;
    }

    successSessionIdRef.current = result.sessionId;
    setIsSuccessful(true);
  };

  const product = productId ? getProduct(productId) : undefined;

  if (initialized && !product) {
    return (
      <main className="checkout-page">
        <section className="checkout-card checkout-error-card" aria-labelledby="product-error-title">
          <p className="checkout-eyebrow">Something's wrong</p>
          <h1 id="product-error-title">We couldn't load this product</h1>
          <p className="success-message">
            The product this checkout was opened for doesn't exist. Please go back and try again.
          </p>
          <button type="button" className="pay-button success-action" onClick={requestClose}>
            Close
          </button>
        </section>
      </main>
    );
  }

  if (isSuccessful) {
    return (
      <main className="checkout-page">
        <section className="checkout-card checkout-success-card" aria-labelledby="success-title" role="status">
          <div className="success-icon" aria-hidden="true">
            ✓
          </div>
          <p className="checkout-eyebrow">Payment complete</p>
          <h1 id="success-title">You're all set</h1>
          <p className="success-message">Your payment was processed successfully.</p>
          {product && <p className="checkout-product">{product.name}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="checkout-page">
      <section className="checkout-card" aria-labelledby="checkout-title">
        <header className="checkout-header">
          <div>
            <p className="checkout-eyebrow">Secure checkout</p>
            <h1 id="checkout-title">Complete your purchase</h1>
          </div>

          <button
            type="button"
            className="close-button"
            onClick={requestClose}
            disabled={isProcessing}
            aria-label="Close checkout"
          >
            ×
          </button>
        </header>

        {product ? (
          <div className="checkout-product-summary">
            <img src={product.image} alt="" className="checkout-product-image" />
            <div>
              <p className="checkout-product-name">{product.name}</p>
              <p className="checkout-product-description">{product.description}</p>
            </div>
            <p className="checkout-product-price">{formatPrice(product.priceCents, product.currency)}</p>
          </div>
        ) : (
          <div className="checkout-product-summary checkout-product-summary--loading" aria-hidden="true" />
        )}

        <form className="checkout-form" onSubmit={handleSubmit} noValidate>
          <div className="form-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              value={email}
              ref={emailInputRef}
              onChange={(event) => {
                setEmail(event.target.value);
                if (errorMessage) setErrorMessage("");
              }}
              disabled={isProcessing}
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="card-number">Card number</label>
            <input
              id="card-number"
              name="card-number"
              type="text"
              inputMode="numeric"
              placeholder="4242 4242 4242 4242"
              autoComplete="cc-number"
              value={cardNumber}
              onChange={(event) => handleCardNumberChange(event.target.value)}
              disabled={isProcessing}
              maxLength={19}
              required
            />
            <span className="field-hint">Use one of the sandbox test cards to try each outcome.</span>
          </div>

          <div className="checkout-row">
            <div className="form-field">
              <label htmlFor="expiry">Expiry</label>
              <input
                id="expiry"
                name="expiry"
                type="text"
                inputMode="numeric"
                placeholder="MM/YY"
                autoComplete="cc-exp"
                value={expiry}
                onChange={(event) => handleExpiryChange(event.target.value)}
                disabled={isProcessing}
                maxLength={5}
                required
              />
            </div>

            <div className="form-field">
              <label htmlFor="cvc">CVC</label>
              <input
                id="cvc"
                name="cvc"
                type="password"
                inputMode="numeric"
                placeholder="123"
                autoComplete="cc-csc"
                value={cvc}
                onChange={(event) => handleCvcChange(event.target.value)}
                disabled={isProcessing}
                maxLength={3}
                required
              />
            </div>
          </div>

          {errorMessage && (
            <div className="checkout-error" role="alert" aria-live="polite">
              {errorMessage}
            </div>
          )}

          <button type="submit" className="pay-button" disabled={isProcessing || isSuccessful}>
            {isProcessing ? "Processing…" : "Pay securely"}
          </button>
        </form>

        <footer className="checkout-footer">
          <span>Secure payment</span>
          <span>Demo checkout</span>
        </footer>
      </section>
    </main>
  );
};

export default CheckoutApp;
