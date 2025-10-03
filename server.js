require("dotenv").config();
const express = require("express");
const path = require("path");
const fetch = require("node-fetch");
const app = express();

app.use(express.static("public"));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

const PORT = process.env.PORT || 3000;

//secret keys and configuration
const SECRET_KEY = process.env.SECRET_KEY;
const pcidHK = process.env.PCID_HK;

// This endpoint dynamically creates a payment session based on quantity
app.post("/create-payment-sessions", async (req, res) => {
  try {
    const { quantity, currency } = req.body;

    // Basic validation
    if (!quantity || typeof quantity !== "number" || quantity < 1) {
      return res.status(400).json({ error: "A valid quantity is required." });
    }

    const unitPriceInCents = 9000;
    const totalAmountInCents = unitPriceInCents * quantity;

    /*------------ Details in payment data determines the availability of payment methods -------------------------*/
    const paymentData = {
      amount: totalAmountInCents,
      currency: currency,
      // Adding a timestamp to make the reference unique for each request
      reference: `ORD-${Date.now()}`,
      display_name: "Online shop",
      payment_type: "Regular",
      billing: {
        address: {
          country: "HK",
        },
      },
      customer: {
        name: "Neal Fung",
        email: "neal@dummy.com",
      },
      items: [
        {
          reference: "0001",
          name: "New iPhone Case designed by Neal",
          quantity: quantity,
          unit_price: unitPriceInCents,
        },
      ],
      capture: true,
      processing_channel_id: pcidHK,
      success_url: "https://example.com/payments/success",
      failure_url: "https://example.com/payments/failure",
    };

    // Create a PaymentSession with the dynamic data
    const response = await fetch(
      "https://api.sandbox.checkout.com/payment-sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(paymentData),
      }
    );

    const paymentSession = await response.json();

    if (!response.ok) {
      // Forward the error from the payment gateway
      return res.status(response.status).send(paymentSession);
    }

    res.status(response.status).send(paymentSession);
  } catch (error) {
    console.error("Error processing payment session:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// This endpoint handles refund requests
app.post("/refund-payment", async (req, res) => {
  try {
    const { paymentId, amount } = req.body;

    // Basic validation
    if (!paymentId || !amount || typeof amount !== "number" || amount <= 0) {
      return res
        .status(400)
        .json({ error: "A valid Payment ID and amount are required." });
    }

    // Amount should be in the smallest currency unit (cents)
    const amountInCents = Math.round(amount * 100);

    const refundData = {
      amount: amountInCents,
      reference: `REF-${paymentId}-${Date.now()}`, // Unique reference for the refund
    };

    const refundUrl = `https://api.sandbox.checkout.com/payments/${paymentId}/refunds`;

    // Process the refund
    const response = await fetch(refundUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(refundData),
    });

    const refundResponse = await response.json();

    if (!response.ok) {
      console.error("Refund failed:", refundResponse);
      return res.status(response.status).send(refundResponse);
    }

    res.status(response.status).send(refundResponse);
  } catch (error) {
    console.error("Error processing refund:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// --- NEW WEBHOOK ENDPOINT ---
app.post("/webhook", (req, res) => {
  // 1. Verify the signature to ensure the request is from Checkout.com
  const signature = req.headers["cko-signature"];
  const hmac = crypto.createHmac("sha256", "0ee38863-bab9-4662-931f-0ace17835489");
  const hash = hmac.update(req.rawBody).digest("hex");

  if (hash !== signature) {
    // Signature is invalid, reject the request
    console.warn("Invalid webhook signature received.");
    return res.status(401).send("Unauthorized");
  }

  // 2. Process the webhook event
  const event = req.body;
  console.log(`Webhook received: ${event.type}`);

  // You can use a switch statement to handle different event types
  switch (event.type) {
    case "payment_captured":
      // A payment was successfully captured.
      // You might update your database, trigger shipping, etc.
      console.log(`Payment captured for: ${event.data.id}`);
      break;
    case "payment_refunded":
      // A payment was successfully refunded.
      // You might update your records.
      console.log(`Refund processed for payment: ${event.data.id}`);
      break;
    case "payment_approved":
      console.log(`Payment approved for: ${event.data.id}`);
      break;
    // Add other event types you want to handle
    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  // 3. Acknowledge receipt by sending a 200 OK response
  res.status(200).send("Webhook received");
});

app.listen(PORT, () =>
  console.log(`Server is running on http://localhost:${PORT}`)
);
