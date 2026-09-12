export type PaymentResult =
  | {
      status: "success";
      sessionId: string;
    }
  | {
      status: "error";
      code: string;
      message: string;
    };

const SUCCESS_CARD = "4242424242424242";
const DECLINED_CARD = "4000000000000002";
const RETRY_CARD = "4000000000000341";

const SIMULATED_LATENCY_MS = 900;

const retryAttempts = new Set<string>();

const normalizeCardNumber = (cardNumber: string): string => {
  return cardNumber.replace(/\s/g, "");
};

const createSessionId = (): string => {
  return `cs_demo_${crypto.randomUUID()}`;
};

const wait = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export const processPayment = async (
  cardNumber: string,
  checkoutId: string,
): Promise<PaymentResult> => {
  await wait(SIMULATED_LATENCY_MS);

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return {
      status: "error",
      code: "NETWORK_ERROR",
      message: "You appear to be offline. Check your connection and try again.",
    };
  }

  const normalizedCardNumber = normalizeCardNumber(cardNumber);

  if (normalizedCardNumber === SUCCESS_CARD) {
    return {
      status: "success",
      sessionId: createSessionId(),
    };
  }

  if (normalizedCardNumber === DECLINED_CARD) {
    return {
      status: "error",
      code: "CARD_DECLINED",
      message: "Your card was declined. Please try another card.",
    };
  }

  if (normalizedCardNumber === RETRY_CARD) {
    if (!retryAttempts.has(checkoutId)) {
      retryAttempts.add(checkoutId);

      return {
        status: "error",
        code: "PAYMENT_FAILED",
        message: "Payment failed. Please try again.",
      };
    }

    return {
      status: "success",
      sessionId: createSessionId(),
    };
  }

  return {
    status: "error",
    code: "INVALID_CARD",
    message: "This card is not supported by the demo checkout.",
  };
};
