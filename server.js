import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { nanoid } from "nanoid";
import useragent from "express-useragent";
import requestIp from "request-ip";

dotenv.config();

mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Define schemas
const LinkSchema = new mongoose.Schema({
  originalUrl: { type: String, required: true },
  shortCode: { type: String, required: true, unique: true },
  userId: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: null },
  clicks: { type: Number, default: 0 },
});

const ClickSchema = new mongoose.Schema({
  linkId: { type: mongoose.Schema.Types.ObjectId, ref: "Link" },
  timestamp: { type: Date, default: Date.now },
  ip: String,
  browser: String,
  os: String,
  device: String,
  referrer: String,
});

const Link = mongoose.model("Link", LinkSchema);
const Click = mongoose.model("Click", ClickSchema);

const app = express();

const users = [
  {
    id: 1,
    email: process.env.EMAIL,
    password: process.env.PASSWORD,
  },
];

app.use(cors());
app.use(express.json());
app.use(express.static("public"));
app.use(useragent.express());

const authenticateToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET || "secret_key", (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

app.post("/api/verifyToken", (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(400).json({ isValid: false });
  }

  jwt.verify(token, process.env.JWT_SECRET || "secret_key", (err, decoded) => {
    if (err) {
      return res.status(400).json({ isValid: false });
    }
    return res.status(200).json({ isValid: true, userId: decoded.id });
  });
});

app.post("/api/login", async (req, res) => {
  const user = users.find((u) => u.email === req.body.email);
  if (!user) return res.status(400).json({ error: "User not found" });

  try {
    const isValid = await bcrypt.compare(req.body.password, user.password);

    if (isValid) {
      const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET);
      res.json({ accessToken: token, userId: user.id });
    } else {
      res.status(400).json({ error: "Invalid password" });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/links", authenticateToken, async (req, res) => {
  try {
    const { originalUrl, customAlias, expiresAt } = req.body;

    if (!originalUrl) {
      return res.status(400).json({ error: "URL is required" });
    }

    try {
      new URL(originalUrl);
    } catch (err) {
      return res.status(400).json({ error: "Invalid URL format" });
    }

    let shortCode = customAlias;
    if (!shortCode) {
      shortCode = nanoid(6); // Generate 6-character unique ID
    } else {
      const existingLink = await Link.findOne({ shortCode });
      if (existingLink) {
        return res.status(400).json({ error: "Custom alias already in use" });
      }
    }

    const newLink = new Link({
      originalUrl,
      shortCode,
      userId: req.user.id,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    });

    await newLink.save();
    res.status(201).json(newLink);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/links", authenticateToken, async (req, res) => {
  try {
    const links = await Link.find({ userId: req.user.id }).sort({
      createdAt: -1,
    });
    res.json(links);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/links/:id", authenticateToken, async (req, res) => {
  try {
    const link = await Link.findById(req.params.id);

    if (!link) {
      return res.status(404).json({ error: "Link not found" });
    }

    if (link.userId !== req.user.id) {
      return res.status(403).json({ error: "Not authorized" });
    }

    await link.deleteOne();
    await Click.deleteMany({ linkId: req.params.id });

    res.json({ message: "Link deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/:shortCode", async (req, res) => {
  try {
    const { shortCode } = req.params;
    const link = await Link.findOne({ shortCode });

    if (!link) {
      return res.status(404).send("Link not found");
    }

    if (link.expiresAt && new Date() > new Date(link.expiresAt)) {
      return res.status(410).send("Link has expired");
    }

    link.clicks += 1;
    await link.save();

    const clickData = new Click({
      linkId: link._id,
      ip: requestIp.getClientIp(req),
      browser: req.useragent.browser,
      os: req.useragent.os,
      device: req.useragent.isMobile
        ? "mobile"
        : req.useragent.isTablet
        ? "tablet"
        : "desktop",
      referrer: req.headers.referer || "direct",
    });

    clickData
      .save()
      .catch((err) => console.error("Error saving click data:", err));

    res.redirect(link.originalUrl);
  } catch (err) {
    res.status(500).send("Server error");
  }
});

app.get("/api/links/:id/analytics", authenticateToken, async (req, res) => {
  try {
    const link = await Link.findById(req.params.id);

    if (!link) {
      return res.status(404).json({ error: "Link not found" });
    }

    if (link.userId !== req.user.id) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const clicks = await Click.find({ linkId: req.params.id });

    const clicksByDay = {};
    const deviceStats = { desktop: 0, mobile: 0, tablet: 0 };
    const browserStats = {};

    clicks.forEach((click) => {
      const day = new Date(click.timestamp).toISOString().split("T")[0];
      clicksByDay[day] = (clicksByDay[day] || 0) + 1;

      deviceStats[click.device] = (deviceStats[click.device] || 0) + 1;

      browserStats[click.browser] = (browserStats[click.browser] || 0) + 1;
    });

    res.json({
      totalClicks: link.clicks,
      clicksByDay,
      deviceStats,
      browserStats,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
