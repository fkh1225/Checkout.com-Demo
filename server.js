require("dotenv").config();
const express = require("express");
const path = require("path");
const fetch = require("node-fetch");
const app = express();

app.use(express.static("public"));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

const PORT = process.env.PORT || 3002;

//secret keys and configuration
const SECRET_KEY = process.env.SECRET_KEY;
const pcidHK = process.env.PCID_HK;

// This endpoint dynamically creates a payment session based on quantity
app.post("/create-payment-sessions", async (req, res) => {
  try {
    const { quantity } = req.body;

    // Basic validation
    if (!quantity || typeof quantity !== "number" || quantity < 1) {
      return res.status(400).json({ error: "A valid quantity is required." });
    }

    const unitPriceInCents = 9000; // 90.00 HKD expressed in the smallest currency unit
    const totalAmountInCents = unitPriceInCents * quantity;

    /*------------ Details in payment data determines the availability of payment methods -------------------------*/
    const paymentData = {
      amount: totalAmountInCents,
      currency: "HKD",
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

    // Process the refund with Checkout.com
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

app.listen(PORT, () =>
  console.log(`Server is running on http://localhost:${PORT}`)
);
