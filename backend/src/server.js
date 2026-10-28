const express = require("express");
const { connectDB } = require("./config/db");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());

const startServer = async () => {
    await connectDB();

    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
};

startServer();