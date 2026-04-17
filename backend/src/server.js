const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

const authRoutes     = require("./routes/auth.routes");
const userRoutes     = require("./routes/user.routes");
const managerRoutes  = require("./routes/manager.routes");
const employeeRoutes = require("./routes/employee.routes");
const companyRoutes  = require("./routes/company.routes");
const doctorRoutes   = require("./routes/doctor.routes");
const taskRoutes     = require("./routes/task.routes");

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 5000);

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000"
  })
);
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ success: true, message: "Backend is running." });
});

app.use("/api/auth",      authRoutes);
app.use("/api/users",     userRoutes);
app.use("/api/managers",  managerRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/companies", companyRoutes);
app.use("/api/doctors",   doctorRoutes);
app.use("/api/tasks",     taskRoutes);

app.listen(port, () => {
  console.log(`Workiya backend running on port ${port}`);
});
