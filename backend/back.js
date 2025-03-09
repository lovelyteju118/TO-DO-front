require("dotenv").config(); // For environment variables
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = process.env.PORT || 5000; // Load PORT from .env or default to 5000
const SECRET_KEY = process.env.SECRET_KEY || "your_secret_key"; // Load secret key from .env

// Middleware
app.use(express.json());
app.use(cors());

// MongoDB Connection
mongoose
    .connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/todolist", {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 5000, // Wait 5 seconds before timing out
    })
    .then(() => console.log("MongoDB connected successfully"))
    .catch((err) => console.error("MongoDB connection error:", err));

// User Schema
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
});
const User = mongoose.model("User", UserSchema);

// Task Schema
const TaskSchema = new mongoose.Schema({
    text: { type: String, required: true },
    completed: { type: Boolean, default: false },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
});
const Task = mongoose.model("Task", TaskSchema);

// **Register User**
app.post("/register", async (req, res) => {
    const { username, password } = req.body;
    console.log("Request Body:", req.body); // Debugging log

    if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required" });
    }

    try {
        console.log("Hashing password...");
        const hashedPassword = await bcrypt.hash(password, 10);

        console.log("Saving new user to database...");
        const newUser = new User({ username, password: hashedPassword });
        await newUser.save();

        console.log("User registered successfully");
        res.status(201).json({ message: "User registered successfully" });
    } catch (err) {
        console.error("Registration Error:", err);

        // Handle duplicate username case
        if (err.code === 11000) {
            return res.status(400).json({ error: "Username already exists" });
        }

        res.status(500).json({ error: "Failed to register user" });
    }
});

// **Login User**
app.post("/login", async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required" });
    }

    try {
        const user = await User.findOne({ username });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: "Invalid username or password" });
        }

        const token = jwt.sign({ userId: user._id }, SECRET_KEY, { expiresIn: "1h" });
        res.status(200).json({ token });
    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({ error: "Failed to log in" });
    }
});

// **Middleware to Verify JWT**
const authenticate = (req, res, next) => {
    const token = req.headers["authorization"];
    if (!token) {
        return res.status(401).json({ error: "Access denied. No token provided." });
    }

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        req.userId = decoded.userId;
        next();
    } catch (err) {
        res.status(401).json({ error: "Invalid token" });
    }
};

// **Get Tasks (Authenticated Users)**
app.get("/tasks", authenticate, async (req, res) => {
    try {
        const tasks = await Task.find({ userId: req.userId });
        res.status(200).json(tasks);
    } catch (err) {
        console.error("Fetch tasks error:", err);
        res.status(500).json({ error: "Failed to fetch tasks" });
    }
});

// **Add New Task**
app.post("/tasks", authenticate, async (req, res) => {
    const { text } = req.body;

    if (!text) {
        return res.status(400).json({ error: "Task text is required" });
    }

    try {
        const newTask = new Task({ text, userId: req.userId });
        await newTask.save();
        res.status(201).json(newTask);
    } catch (err) {
        console.error("Add task error:", err);
        res.status(500).json({ error: "Failed to add task" });
    }
});

// **Delete Task**
app.delete("/tasks/:id", authenticate, async (req, res) => {
    try {
        const deletedTask = await Task.findOneAndDelete({
            _id: req.params.id,
            userId: req.userId,
        });

        if (!deletedTask) {
            return res.status(404).json({ error: "Task not found" });
        }

        res.status(200).json({ message: "Task deleted successfully" });
    } catch (err) {
        console.error("Delete task error:", err);
        res.status(500).json({ error: "Failed to delete task" });
    }
});

// **Test Route**
app.get("/", (req, res) => {
    res.send("Server is running successfully!");
});

// **Start Server**
app.listen(PORT, () => {
    console.log(`Server started running on port ${PORT}`);
});

async function registerUser() {
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    const response = await fetch("http://localhost:5000/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
    });

    const data = await response.json();
    alert(data.message || data.error);
}

async function loginUser() {
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    const response = await fetch("http://localhost:5000/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
    });

    const data = await response.json();
    if (data.token) {
        localStorage.setItem("token", data.token);
        alert("Login successful!");
    } else {
        alert(data.error);
    }
}

async function fetchTasks() {
    const token = localStorage.getItem("token");
    const response = await fetch("http://localhost:5000/tasks", {
        headers: { "Authorization": `Bearer ${token}` },
    });

    const tasks = await response.json();
    console.log(tasks);
}

