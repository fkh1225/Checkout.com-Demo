/* global CheckoutWebComponents */

// --- DOM Element Selection ---
const quantityValue = document.getElementById("quantity-value");
const quantityMinus = document.getElementById("quantity-minus");
const quantityPlus = document.getElementById("quantity-plus");
const priceDisplay = document.getElementById("price-display");
const flowContainer = document.getElementById("flow-container");
const addressContainer = document.getElementById("address-container");
const authContainer = document.getElementById("authentication-container");

// --- State and Constants ---
const UNIT_PRICE = 90.0; // Price per item in HKD in Cents
let currentQuantity = 1;
const PUBLIC_KEY = "pk_sbox_62ssf4ywm7wxnlz7joovagwbqu3";
/**
 * Debounce function to delay function execution. This prevents firing an API call
 * for every single click if the user is rapidly changing the quantity.
 * @param {Function} func The function to debounce.
 * @param {number} delay The delay in milliseconds.
 * @returns {Function} The debounced function.
 */
function debounce(func, delay) {
  let timeout;
  return function (...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), delay);
  };
}

/**
 * Toggles the disabled state of the quantity adjustment buttons.
 * @param {boolean} disabled - Whether the controls should be disabled.
 */
function setQuantityControlsDisabled(disabled) {
  quantityPlus.disabled = disabled;
  // Also consider current quantity for the minus button
  quantityMinus.disabled = disabled || currentQuantity === 1;
}

/**
 * Fetches a new payment session and re-mounts the payment form components.
 */
async function updatePaymentSession() {
  setQuantityControlsDisabled(true);
  // Display a loading spinner and clear previous components
  flowContainer.innerHTML = `
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <span>Updating Payment Details...</span>
    </div>`;
  addressContainer.innerHTML = "";
  authContainer.innerHTML = "";

  try {
    const response = await fetch("/create-payment-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity: currentQuantity }),
    });

    const paymentSession = await response.json();

    if (!response.ok) {
      flowContainer.innerHTML =
        '<div class="error-message">Error loading payment form. Please refresh and try again.</div>';
      throw new Error("Failed to create payment session.");
    }

    flowContainer.innerHTML = ""; // Clear loading message

    const checkout = await CheckoutWebComponents({
      publicKey: PUBLIC_KEY,
      environment: "sandbox",
      locale: "en-GB",
      paymentSession,
      appearance: {
        colorAction: "#323416",
        colorFormBorder: "#8C9E6E",
        colorPrimary: "#323416",
      },
      componentOptions: {
        flow: {
          acceptedCardSchemes: [
            "visa",
            "mastercard",
            "american_express",
            "discover",
            "diners_club_international",
            "jcb",
          ],
        },
      },
      onPaymentCompleted: (_component, paymentResponse) =>
        console.log("Create Payment with PaymentId: ", paymentResponse.id),
    });

    const flowComponent = checkout.create("flow");
    flowComponent.mount(flowContainer);

    const addressComponent = checkout.create("shipping_address");
    if (await addressComponent.isAvailable()) {
      addressComponent.mount(addressContainer);
    }

    const authenticationComponent = checkout.create("authentication");
    authenticationComponent.mount(authContainer);
  } catch (error) {
    console.error("Payment session update failed:", error);
    if (!flowContainer.querySelector(".error-message")) {
      flowContainer.innerHTML =
        '<div class="error-message">Could not load payment options.</div>';
    }
  } finally {
    setQuantityControlsDisabled(false); // Re-enable controls
  }
}

const debouncedUpdatePaymentSession = debounce(updatePaymentSession, 1000);

/**
 * Updates the total price in the UI and triggers a payment session update.
 */
function handleQuantityChange() {
  const totalPrice = UNIT_PRICE * currentQuantity.toFixed(2);
  quantityValue.value = currentQuantity;
  priceDisplay.textContent = `${totalPrice} HKD`;
  quantityMinus.disabled = currentQuantity === 1;

  debouncedUpdatePaymentSession();
}

// --- Event Listeners ---
quantityPlus.addEventListener("click", () => {
  currentQuantity++;
  handleQuantityChange();
});

quantityMinus.addEventListener("click", () => {
  if (currentQuantity > 1) {
    currentQuantity--;
    handleQuantityChange();
  }
});

/**
 * Initializes the page on first load.
 */
function initializePage() {
  const totalPrice = UNIT_PRICE * currentQuantity.toFixed(2);
  quantityValue.value = currentQuantity;
  priceDisplay.textContent = `${totalPrice} HKD`;
  quantityMinus.disabled = currentQuantity === 1;

  // Create the initial payment session on page load directly
  updatePaymentSession();
}

initializePage();

// --- Toast and URL Parameter Logic ---
function triggerToast(id) {
  const element = document.getElementById(id);
  if (element) {
    element.classList.add("show");
    setTimeout(() => element.classList.remove("show"), 5000);
  }
}

const urlParams = new URLSearchParams(window.location.search);
const paymentStatus = urlParams.get("status");
const paymentId = urlParams.get("cko-payment-id");

if (paymentStatus === "succeeded") triggerToast("successToast");
if (paymentStatus === "failed") triggerToast("failedToast");
if (paymentId) console.log("Create Payment with PaymentId: ", paymentId);
