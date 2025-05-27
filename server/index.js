// index.js
require('dotenv').config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Routes
const ragResponseRoute = require("./routes/ragResponseRoute");
app.use("/api/rag-response", ragResponseRoute);

// Basic endpoints
app.get("/", (req, res) => {
  res.send("✅ Healthcare Bot API is running");
});

app.post("/api/book-appointment", (req, res) => {
  // ... keep your existing appointment logic
});

app.post("/api/calculate-bmi", (req, res) => {
  // ... keep your existing BMI logic
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});