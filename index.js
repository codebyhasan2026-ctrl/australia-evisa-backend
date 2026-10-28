const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const cookieParser = require("cookie-parser");
const cloudinary = require("cloudinary");
const initSuperAdmin = require("./utils/initSuperAdmin");
const authRoutes = require("./routes/authRoutes");
const adminAuthRoutes = require("./routes/adminAuthRoutes");
const adminUserRoutes = require("./routes/adminUserRoutes");
const adminDashboardRoutes = require("./routes/adminDashboardRoutes");
const visaRoutes = require("./routes/visaRoutes");

const path = require("path");

dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();

app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));
app.use(cors());
app.use(cookieParser());

cloudinary.v2.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("MongoDB Connected Successfully");
    await initSuperAdmin();
  })
  .catch((err) => console.error("MongoDB Connection Failed:", err));

app.get("/", (req, res) => {
  res.send("MERN Backend Running Successfully!");
});

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminAuthRoutes);
app.use("/api/admin", adminUserRoutes);
app.use("/api/admin", adminDashboardRoutes);
app.use("/api/visa", visaRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  if (process.env.EMAIL_USER) {
    console.log(`[EmailService] Ready with sender: ${process.env.EMAIL_USER}`);
  }
});

