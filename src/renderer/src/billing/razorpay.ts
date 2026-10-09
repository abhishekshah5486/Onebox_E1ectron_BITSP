// Razorpay's checkout popup, loaded from Razorpay when first needed.
const SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js';

interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_subscription_id: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open(): void;
  on(
    event: 'payment.failed',
    handler: (failure: { error?: { description?: string } }) => void,
  ): void;
}

type RazorpayConstructor = new (options: Record<string, unknown>) => RazorpayInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

let loading: Promise<RazorpayConstructor> | null = null;

function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  loading ??= new Promise<RazorpayConstructor>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT;
    script.async = true;
    script.onload = () =>
      window.Razorpay ? resolve(window.Razorpay) : reject(new Error('Checkout did not load'));
    script.onerror = () => {
      loading = null;
      script.remove();
      reject(new Error('Could not reach the payment provider. Check your connection.'));
    };
    document.head.append(script);
  });
  return loading;
}

export type CheckoutOutcome =
  | { kind: 'paid'; paymentId: string; subscriptionId: string; signature: string }
  | { kind: 'dismissed' }
  | { kind: 'failed'; reason: string };

// Opens checkout for a subscription and settles once it is paid, closed or refused.
export async function openRazorpayCheckout(options: {
  keyId: string;
  subscriptionId: string;
  description: string;
  email: string;
  // Called once Razorpay's window is showing.
  onOpen?: () => void;
}): Promise<CheckoutOutcome> {
  const Razorpay = await loadRazorpay();
  return new Promise((resolve) => {
    let failure: string | null = null;
    const checkout = new Razorpay({
      key: options.keyId,
      subscription_id: options.subscriptionId,
      name: 'OneBox',
      description: options.description,
      prefill: { email: options.email },
      theme: { color: '#0b57d0' },
      handler: (response: RazorpayResponse) =>
        resolve({
          kind: 'paid',
          paymentId: response.razorpay_payment_id,
          subscriptionId: response.razorpay_subscription_id,
          signature: response.razorpay_signature,
        }),
      modal: {
        // Closing after a refused payment reports the refusal, not just a closed window.
        ondismiss: () =>
          resolve(failure ? { kind: 'failed', reason: failure } : { kind: 'dismissed' }),
      },
    });
    checkout.on('payment.failed', (event) => {
      failure = event.error?.description ?? 'The payment was declined.';
    });
    checkout.open();
    options.onOpen?.();
  });
}
