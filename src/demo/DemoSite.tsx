import { useCallback, useRef, useState } from "react";

import { formatPrice, PRODUCTS } from "../data/products";

import "./demo.css";

interface LogEntry {
  id: string;
  time: string;
  kind: "success" | "error" | "close";
  title: string;
  detail: string;
}

const TEST_CARDS = [
  { number: "4242 4242 4242 4242", result: "Succeeds" },
  { number: "4000 0000 0000 0002", result: "Declines" },
  { number: "4000 0000 0000 0341", result: "Fails once, then succeeds" },
];

const formatTime = (): string => {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

const DemoSite = () => {
  const [events, setEvents] = useState<LogEntry[]>([]);
  const [checkoutOpenFor, setCheckoutOpenFor] = useState<string | null>(null);
  const [copiedCard, setCopiedCard] = useState<string | null>(null);

  const copyResetTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pushEvent = useCallback((entry: Omit<LogEntry, "id" | "time">) => {
    setEvents((current) =>
      [{ id: crypto.randomUUID(), time: formatTime(), ...entry }, ...current].slice(0, 20),
    );
  }, []);

  const handleBuy = (productId: string): void => {
    if (checkoutOpenFor) {
      return;
    }

    setCheckoutOpenFor(productId);

    window.DodoCheckout.open({
      productId,
      onSuccess: ({ sessionId }) => {
        console.info("[DodoCheckout] onSuccess", { sessionId });
        pushEvent({ kind: "success", title: "onSuccess", detail: `sessionId: ${sessionId}` });
        setCheckoutOpenFor(null);
      },
      onError: ({ code, message }) => {
        console.error("[DodoCheckout] onError", { code, message });
        pushEvent({ kind: "error", title: "onError", detail: `${code} — ${message}` });
      },
      onClose: ({ reason }) => {
        console.info("[DodoCheckout] onClose", { reason });
        pushEvent({ kind: "close", title: "onClose", detail: `reason: ${reason}` });
        setCheckoutOpenFor(null);
      },
    });
  };

  const handleCopyCard = async (cardNumber: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(cardNumber.replace(/\s/g, ""));
      setCopiedCard(cardNumber);

      if (copyResetTimeout.current) clearTimeout(copyResetTimeout.current);
      copyResetTimeout.current = setTimeout(() => setCopiedCard(null), 1500);
    } catch {
      /* empty */
    }
  };

  return (
    <div className="store">
      <header className="store-header">
        <div className="store-brand">
          <span className="store-brand-mark" aria-hidden="true">
            ✦
          </span>
          Home
        </div>
        <p className="store-tagline">A pretend store integrating the Dodo Checkout SDK.</p>
      </header>

      <main className="store-main">
        <section className="store-products" aria-label="Products">
          {Object.values(PRODUCTS).map((product) => {
            const isThisCheckoutOpen = checkoutOpenFor === product.id;
            const isAnyCheckoutOpen = checkoutOpenFor !== null;

            return (
              <article className="product-card" key={product.id}>
                <img src={product.image} alt="" className="product-card-image" />
                <div className="product-card-body">
                  <h2>{product.name}</h2>
                  <p>{product.description}</p>
                  <div className="product-card-footer">
                    <span className="product-card-price">
                      {formatPrice(product.priceCents, product.currency)}
                    </span>
                    <button
                      type="button"
                      className="buy-button"
                      onClick={() => handleBuy(product.id)}
                      disabled={isAnyCheckoutOpen}
                    >
                      {isThisCheckoutOpen ? "Checkout open…" : "Buy now"}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>

        <aside className="store-sidebar">
          <section className="panel">
            <h3>Test cards</h3>
            <p className="panel-hint">Use these inside the checkout to exercise each outcome.</p>
            <ul className="test-cards">
              {TEST_CARDS.map((card) => (
                <li key={card.number}>
                  <div>
                    <code>{card.number}</code>
                    <span>{card.result}</span>
                  </div>
                  <button type="button" onClick={() => handleCopyCard(card.number)}>
                    {copiedCard === card.number ? "Copied" : "Copy"}
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="panel">
            <h3>Callback log</h3>
            <p className="panel-hint">Everything the SDK reports back to this page, in order.</p>
            {events.length === 0 ? (
              <p className="log-empty">No events yet — click Buy now to test the checkout.</p>
            ) : (
              <ul className="event-log" aria-live="polite">
                {events.map((event) => (
                  <li key={event.id} className={`event-item event-item--${event.kind}`}>
                    <div className="event-item-row">
                      <span className="event-item-title">{event.title}</span>
                      <span className="event-item-time">{event.time}</span>
                    </div>
                    <span className="event-item-detail">{event.detail}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </main>
    </div>
  );
};

export default DemoSite;
