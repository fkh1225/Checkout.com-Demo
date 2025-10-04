require("dotenv").config();
const express = require("express");
const path = require("path");
const fetch = require("node-fetch");
const crypto = require("crypto"); // Import the crypto module for security
const app = express();

// A raw body is needed to verify the webhook signature
// The "verify" function will be called for each request,
// and we'll save the raw body on the request object.
const rawBodySaver = (req, res, buf, encoding) => {
  if (buf && buf.length) {
    req.rawBody = buf.toString(encoding || "utf8");
  }
};

// Use the raw body saver for all routes, but also use express.json() for parsing
app.use(express.json({ verify: rawBodySaver }));
app.use(express.urlencoded({ extended: true, verify: rawBodySaver }));


app.use(express.static("public"));
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3002;

// --- Environment Variables ---
const SECRET_KEY = process.env.SECRET_KEY;
const pcidHK = process.env.PCID_HK;

app.post("/create-payment-sessions", async (req, res) => {
    const { quantity, currency } = req.body;

    if (!quantity || quantity <= 0) {
        return res.status(400).json({ error: "Invalid quantity" });
    }

    // Calculate total amount on the server to prevent manipulation
    const unitPrice = 9000; // 90.00 in the smallest currency unit (e.g., cents)
    const totalAmount = unitPrice * quantity;

    const paymentData = {
        amount: totalAmount,
        currency: currency || "HKD",
        reference: `ORD-${Date.now()}`,
        display_name: "Online shop",
        payment_type: "Regular",
        billing: { address: { country: "HK" } },
        customer: { name: "Neal Fung", email: "neal@dummy.com" },
        items: [{
            reference: "0001",
            name: "New iPhone Case designed by Neal",
            quantity: quantity,
            unit_price: unitPrice,
        }],
        capture: true,
        processing_channel_id: pcidHK,
        // "3ds": {
        // enabled: true,
        // attempt_n3d: false,
      // challenge_indicator: "",
      // exemption: "",
      // allow_upgrade: true,
          // },
        success_url: "https://example.com/payments/success",
        failure_url: "https://example.com/payments/failure",
    };

    try {
        const request = await fetch("https://api.sandbox.checkout.com/payment-sessions", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${SECRET_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(paymentData),
        });
        const parsedPayload = await request.json();
        res.status(request.status).send(parsedPayload);
    } catch (error) {
        console.error("Error creating payment session:", error);
        res.status(500).json({ error: "Could not create payment session." });
    }
});

app.post("/refund-payment", async (req, res) => {
    const { paymentId, amount } = req.body;
    if (!paymentId || !amount) {
        return res.status(400).json({ error: "Payment ID and amount are required." });
    }

    const refundAmount = Math.round(amount * 100);

    try {
        const response = await fetch(`https://api.sandbox.checkout.com/payments/${paymentId}/refunds`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${SECRET_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ amount: refundAmount, reference: `REF-${Date.now()}` }),
        });
        const data = await response.json();
        res.status(response.status).send(data);
    } catch (error) {
        console.error("Error processing refund:", error);
        res.status(500).json({ error: "An unexpected error occurred during the refund." });
    }
});

app.listen(PORT, () =>
  console.log(`Server is running on http://localhost:${PORT}`)
);
