const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
dotenv.config();
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const User = require("./models/User");
const Wishlist = require("./models/Wishlist");
const Profile = require("./models/Profile");
const Order = require("./models/Order");
const reviewRoutes = require("./routes/reviewRoutes");
const Product = require("./models/Product");

const cloudinary = require("./config/cloudinary");
const upload = require("./middleware/upload");
const Cart = require("./models/Cart");

// ================= APP INIT =================
const app = express();

// ================= MIDDLEWARE =================
app.use(cors());
app.use(express.json());

// ================= AUTH MIDDLEWARE =================
function auth(req, res, next) {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
        return res.status(401).json({
            success: false,
            message: "No token provided ❌"
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({
            success: false,
            message: "Invalid token ❌"
        });
    }
}

// ================= TEST ROUTE =================
app.get("/", (req, res) => {
    res.send("Backend Running 🚀");
});



app.use("/reviews", reviewRoutes);



// ================= SIGNUP =================
app.post("/api/signup", async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });
        }

        const existingUser = await User.findOne({ email });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: "User already exists ❌"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await User.create({
            name,
            email,
            password: hashedPassword,
        });

        res.json({
            success: true,
            message: "Signup Success ✅",
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message,
        });
    }
});

// ================= LOGIN =================
app.post("/api/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid Email or Password ❌",
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid Email or Password ❌",
            });
        }

        const token = jwt.sign(
            { id: user._id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );

        res.json({
            success: true,
            message: "Login Success ✅",
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role || "user"   // 🔥 IMPORTANT FIX
            }
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message,
        });
    }
});

// ================= WISHLIST =================
app.post("/wishlist", auth, async (req, res) => {
    try {

        const existing = await Wishlist.findOne({
            userId: req.user.id,
            productId: req.body.productId,
        });

        if (existing) {
            return res.status(400).json({
                message: "Already in wishlist",
            });
        }
        const item = await Wishlist.create({
            ...req.body,
            userId: req.user.id,
        });

        res.status(201).json(item);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.get("/wishlist", auth, async (req, res) => {
    try {
        const items = await Wishlist.find({ userId: req.user.id });
        res.json(items);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.delete("/wishlist/:id", auth, async (req, res) => {
    try {
        await Wishlist.findOneAndDelete({
            _id: req.params.id,
            userId: req.user.id,
        });

        res.json({ message: "Removed" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ================= PROFILE =================
app.put("/api/profile", auth, async (req, res) => {
    try {
        console.log("BODY:", req.body);

        const profile = await Profile.findOneAndUpdate(
            { email: req.user.email },
            req.body,
            {
                new: true,
                upsert: true,
            }
        );

        console.log("UPDATED PROFILE:", profile);

        res.json({
            success: true,
            profile,
        });
    } catch (err) {
        console.log("PUT ERROR:", err);
        res.status(500).json({
            message: err.message,
        });
    }
});

app.get("/api/profile", auth, async (req, res) => {
    try {
        console.log("USER:", req.user);

        const profile = await Profile.findOne({
            email: req.user.email,
        });

        if (!profile) {
            return res.json({
                name: "",
                email: req.user.email,
            });
        }

        res.json(profile);

    } catch (err) {
        console.log(err);
        res.status(500).json({ message: err.message });
    }
});

// ================= ORDERS =================
app.get("/api/orders", auth, async (req, res) => {
    try {
        const orders = await Order.find({
            userId: req.user.id,
        }).sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            orders,
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message,
        });
    }
});

app.post("/api/orders", auth, async (req, res) => {
    try {
        const {
            name,
            email,
            phone,
            address,
            city,
            state,
            pincode,
            items,
            totalAmount,
            deliveryCharge,
            paymentMethod,
            paymentId,
        } = req.body;

        const order = await Order.create({
            userId: req.user.id,

            name,
            email,
            phone,
            address,
            city,
            state,
            pincode,

            items,

            totalAmount,
            deliveryCharge: deliveryCharge || 50,

            paymentMethod: paymentMethod || "Cash on Delivery",
            paymentId: paymentId || "",

            orderStatus: "Processing",
        });

        res.status(201).json({
            success: true,
            message: "Order Placed Successfully ✅",
            order,
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message,
        });
    }
});

app.post("/cart", auth, async (req, res) => {
    console.log(req.user);
    console.log(req.body);

    const existing = await Cart.findOne({
        userId: req.user.id,
        productId: req.body.productId,
    });

    if (existing) {
        existing.quantity += 1;
        await existing.save();
        return res.json(existing);
    }

    const item = await Cart.create({
        ...req.body,
        userId: req.user.id,
    });

    console.log(item);

    res.json(item);
});

app.get("/cart", auth, async (req, res) => {
    const items = await Cart.find({ userId: req.user.id });
    res.json(items);
});


app.delete("/cart/clear", auth, async (req, res) => {
    try {
        await Cart.deleteMany({
            userId: req.user.id,
        });

        res.json({
            success: true,
            message: "Cart Cleared",
        });

    } catch (err) {
        res.status(500).json({
            message: err.message,
        });
    }
});

app.delete("/cart/:id", auth, async (req, res) => {
    try {
        await Cart.findOneAndDelete({
            _id: req.params.id,
            userId: req.user.id,
        });

        res.json({
            success: true,
            message: "Item removed",
        });
    } catch (err) {
        res.status(500).json({
            message: err.message,
        });
    }
});

app.put("/cart/:id", auth, async (req, res) => {
    try {
        const item = await Cart.findOneAndUpdate(
            {
                _id: req.params.id,
                userId: req.user.id,
            },
            {
                quantity: req.body.quantity,
            },
            {
                new: true,
            }
        );

        res.json(item);
    } catch (err) {
        res.status(500).json({
            message: err.message,
        });
    }
});


app.get("/products", async (req, res) => {
    const search = req.query.search || "";

    const products = await Product.find({
        name: { $regex: search, $options: "i" },
    });

    res.json(products);
});



app.post("/upload", upload.single("image"), async (req, res) => {
    try {
        console.log("FILE:", req.file);

        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" });
        }

        const result = await cloudinary.uploader.upload(req.file.path);

        res.json({
            url: result.secure_url,
        });

    } catch (err) {
        console.log("UPLOAD ERROR:", err);
        res.status(500).json({ message: err.message });
    }
});

app.put("/api/profile", auth, async (req, res) => {
    try {
        const profile = await Profile.findOneAndUpdate(
            { email: req.user.email },
            {
                ...req.body,
                profileImage: req.body.profileImage,
            },
            { new: true, upsert: true }
        );

        res.json({ success: true, profile });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


app.post("/products", async (req, res) => {
    try {
        const product = await Product.create(req.body);

        res.status(201).json({
            success: true,
            product,
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message,
        });
    }
});

app.put("/products/:id", async (req, res) => {
    try {
        const product = await Product.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );

        res.json({
            success: true,
            product,
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message,
        });
    }
});

app.delete("/products/:id", async (req, res) => {
    try {
        await Product.findByIdAndDelete(req.params.id);

        res.json({
            success: true,
            message: "Product Deleted ✅",
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message,
        });
    }
});



// ================= DB CONNECT =================
mongoose
    .connect(process.env.MONGO_URI)
    .then(() => console.log("MongoDB Connected ✅"))
    .catch((err) => console.log("Mongo Error ❌", err));

// ================= SERVER =================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} 🚀`);
});