import express from 'express';
import cors from 'cors';
import dotenv from "dotenv";
import http from "http";
import fs from "fs";
import path from "path";
import connectDB from './config/db.js';
import userRoute from './routes/userRoute.js';
import adminRoute from './routes/adminRoute.js';
import partnerRoute from './routes/partnerRoute.js';
import storeRoute from './routes/storeRoute.js';
import itemRoute from './routes/itemRoute.js';
import orderRoute from './routes/orderRoute.js';
import mapRoute from './routes/mapRoute.js';
import reviewRoute from './routes/reviewRoute.js';
import { initSocket } from './socket.js';

dotenv.config();
connectDB();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;
const uploadsDirectoryPath = path.join(process.cwd(), "uploads");

if (!fs.existsSync(uploadsDirectoryPath)) {
  fs.mkdirSync(uploadsDirectoryPath, { recursive: true });
}

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(uploadsDirectoryPath));

app.get('/', (req, res) => {
  res.send('Delivery Service API is running');
});

app.use('/api/users', userRoute);
app.use('/api/admins', adminRoute);
app.use('/api/partners', partnerRoute);
app.use('/api/stores', storeRoute);
app.use('/api/items', itemRoute);
app.use('/api/orders', orderRoute);
app.use('/api/maps', mapRoute);
app.use('/api/reviews', reviewRoute);

initSocket(server);

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
