import express from 'express';
import cors from 'cors';
import dotenv from "dotenv";
import http from "http";
import connectDB from './config/db.js';
import userRoute from './routes/userRoute.js';
import adminRoute from './routes/adminRoute.js';
import partnerRoute from './routes/partnerRoute.js';
import storeRoute from './routes/storeRoute.js';
import itemRoute from './routes/itemRoute.js';
import orderRoute from './routes/orderRoute.js';
import { initSocket } from './socket.js';

dotenv.config();
connectDB();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Delivery Service API is running');
});

app.use('/api/users', userRoute);
app.use('/api/admins', adminRoute);
app.use('/api/partners', partnerRoute);
app.use('/api/stores', storeRoute);
app.use('/api/items', itemRoute);
app.use('/api/orders', orderRoute);

initSocket(server);

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
