import type {
  CheckoutCloseData,
  CheckoutErrorData,
  CheckoutMessage,
  CheckoutSuccessData,
  DodoCheckoutOptions,
} from "../types/checkout";

const CHECKOUT_URL =
  (globalThis as { __DODO_CHECKOUT_URL__?: string }).__DODO_CHECKOUT_URL__ ??
  "/checkout.html";

const READY_TIMEOUT_MS = 10_000;

const getCheckoutOrigin = (): string => {
  return new URL(CHECKOUT_URL, window.location.origin).origin;
};

export interface DodoCheckoutSDKApi {
  open(options: DodoCheckoutOptions): void;
  close(): void;
}

class DodoCheckoutSDK implements DodoCheckoutSDKApi {
  private backdrop: HTMLDivElement | null = null;

  private iframe: HTMLIFrameElement | null = null;

  private options: DodoCheckoutOptions | null = null;

  private checkoutId: string | null = null;

  private isOpen = false;

  private isReady = false;

  private isProcessing = false;

  private readyTimeoutId: ReturnType<typeof setTimeout> | null = null;

  private previousBodyOverflow: string | null = null;

  public open(options: DodoCheckoutOptions): void {
    if (this.isOpen) {
      return;
    }

    this.options = options;
    this.checkoutId = crypto.randomUUID();
    this.isOpen = true;
    this.isReady = false;
    this.isProcessing = false;

    window.addEventListener("message", this.handleMessage);
    window.addEventListener("keydown", this.handleKeydown);

    this.lockPageScroll();
    this.createOverlay();

    this.readyTimeoutId = setTimeout(() => {
      if (!this.isReady) {
        this.handleError({
          code: "CHECKOUT_LOAD_TIMEOUT",
          message: "The checkout took too long to load. Please try again.",
        });
        this.handleClose({ reason: "error" });
      }
    }, READY_TIMEOUT_MS);
  }

  public close(): void {
    if (!this.isOpen || this.isProcessing) {
      return;
    }

    this.sendCloseMessage();
    this.cleanup();

    this.options?.onClose?.({
      reason: "user",
    });
  }

  private createOverlay(): void {
    if (!this.checkoutId || !this.options) {
      return;
    }

    const backdrop = document.createElement("div");
    backdrop.setAttribute("data-dodo-checkout-backdrop", "");
    Object.assign(backdrop.style, {
      position: "fixed",
      inset: "0",
      zIndex: "2147483647",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "16px",
      background: "rgba(15, 15, 15, 0)",
      backdropFilter: "blur(0px)",
      transition: "background 180ms ease",
      boxSizing: "border-box",
    } satisfies Partial<CSSStyleDeclaration>);

    const frameWrap = document.createElement("div");
    Object.assign(frameWrap.style, {
      width: "min(92vw, 460px)",
      height: "min(88vh, 640px)",
      opacity: "0",
      transform: "scale(0.97) translateY(6px)",
      transition: "opacity 180ms ease, transform 180ms ease",
    } satisfies Partial<CSSStyleDeclaration>);

    const iframe = document.createElement("iframe");
    iframe.src = `${CHECKOUT_URL}?checkoutId=${encodeURIComponent(this.checkoutId)}`;
    iframe.title = "Dodo Checkout";
    iframe.setAttribute("aria-label", "Dodo Checkout");
    Object.assign(iframe.style, {
      width: "100%",
      height: "100%",
      border: "0",
      borderRadius: "20px",
      background: "transparent",
      boxShadow: "0 24px 70px rgba(0, 0, 0, 0.35)",
    } satisfies Partial<CSSStyleDeclaration>);

    iframe.onerror = () => {
      this.handleError({
        code: "CHECKOUT_LOAD_FAILED",
        message: "The checkout failed to load. Please try again.",
      });
      this.handleClose({ reason: "error" });
    };

    frameWrap.appendChild(iframe);
    backdrop.appendChild(frameWrap);
    document.body.appendChild(backdrop);

    requestAnimationFrame(() => {
      backdrop.style.background = "rgba(15, 15, 15, 0.55)";
      frameWrap.style.opacity = "1";
      frameWrap.style.transform = "scale(1) translateY(0)";
    });

    this.backdrop = backdrop;
    this.iframe = iframe;
  }

  private lockPageScroll(): void {
    this.previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }

  private unlockPageScroll(): void {
    document.body.style.overflow = this.previousBodyOverflow ?? "";
    this.previousBodyOverflow = null;
  }

  private handleKeydown = (event: KeyboardEvent): void => {
    if (event.key !== "Escape" || !this.isOpen) {
      return;
    }

    this.close();
  };

  private handleMessage = (event: MessageEvent<CheckoutMessage>): void => {
    if (!this.iframe) {
      return;
    }

    if (event.source !== this.iframe.contentWindow) {
      return;
    }

    if (event.origin !== getCheckoutOrigin()) {
      return;
    }

    const message = event.data;

    switch (message.type) {
      case "DODO_CHECKOUT_READY":
        this.isReady = true;
        this.sendInitMessage();
        break;

      case "DODO_CHECKOUT_SUCCESS":
        this.handleSuccess({
          sessionId: message.sessionId,
        });
        break;

      case "DODO_CHECKOUT_ERROR":
        this.handleError({
          code: message.code,
          message: message.message,
        });
        break;

      case "DODO_CHECKOUT_CLOSE":
        this.handleClose({
          reason: message.reason,
        });
        break;

      case "DODO_CHECKOUT_PROCESSING":
        this.isProcessing = message.isProcessing;
        break;

      default:
        break;
    }
  };

  private sendInitMessage(): void {
    if (!this.iframe?.contentWindow) {
      return;
    }

    if (!this.checkoutId || !this.options) {
      return;
    }

    this.iframe.contentWindow.postMessage(
      {
        type: "DODO_CHECKOUT_INIT",
        checkoutId: this.checkoutId,
        productId: this.options.productId,
      },
      getCheckoutOrigin(),
    );
  }

  private sendCloseMessage(): void {
    if (!this.iframe?.contentWindow) {
      return;
    }

    this.iframe.contentWindow.postMessage(
      {
        type: "DODO_CHECKOUT_CLOSE",
        reason: "user",
      },
      getCheckoutOrigin(),
    );
  }

  private handleSuccess(data: CheckoutSuccessData): void {
    this.options?.onSuccess?.(data);
    this.cleanup();
  }

  private handleError(data: CheckoutErrorData): void {
    this.options?.onError?.(data);
  }

  private handleClose(data: CheckoutCloseData): void {
    this.options?.onClose?.(data);
    this.cleanup();
  }

  private cleanup(): void {
    if (this.readyTimeoutId !== null) {
      clearTimeout(this.readyTimeoutId);
      this.readyTimeoutId = null;
    }

    window.removeEventListener("message", this.handleMessage);
    window.removeEventListener("keydown", this.handleKeydown);

    this.unlockPageScroll();

    this.backdrop?.remove();
    this.backdrop = null;
    this.iframe = null;
    this.options = null;
    this.checkoutId = null;
    this.isOpen = false;
    this.isReady = false;
    this.isProcessing = false;
  }
}

export const DodoCheckout: DodoCheckoutSDKApi = new DodoCheckoutSDK();
export default DodoCheckout;

declare global {
  interface Window {
    DodoCheckout: DodoCheckoutSDKApi;
  }
}

if (typeof window !== "undefined") {
  window.DodoCheckout = DodoCheckout;
}
