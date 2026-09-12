export interface DodoCheckoutOptions {
  productId: string;

  onSuccess?: (data: CheckoutSuccessData) => void;

  onClose?: (data: CheckoutCloseData) => void;

  onError?: (data: CheckoutErrorData) => void;
}

export interface CheckoutSuccessData {
  sessionId: string;
}

export interface CheckoutCloseData {
  reason: "user" | "success" | "error";
}

export interface CheckoutErrorData {
  code: string;
  message: string;
}

export interface CheckoutInitMessage {
  type: "DODO_CHECKOUT_INIT";
  checkoutId: string;
  productId: string;
}

export interface CheckoutReadyMessage {
  type: "DODO_CHECKOUT_READY";
}

export interface CheckoutSuccessMessage {
  type: "DODO_CHECKOUT_SUCCESS";
  sessionId: string;
}

export interface CheckoutErrorMessage {
  type: "DODO_CHECKOUT_ERROR";
  code: string;
  message: string;
}

export interface CheckoutCloseMessage {
  type: "DODO_CHECKOUT_CLOSE";
  reason: "user" | "success" | "error";
}

export interface CheckoutProcessingMessage {
  type: "DODO_CHECKOUT_PROCESSING";
  isProcessing: boolean;
}

export type CheckoutMessage =
  | CheckoutReadyMessage
  | CheckoutSuccessMessage
  | CheckoutErrorMessage
  | CheckoutCloseMessage
  | CheckoutProcessingMessage;
