import express from 'express';
import cors from 'cors';
import dotenv from "dotenv";
import connectDB from './config/db.js';
import userRoute from './routes/userRoute.js';
import adminRoute from './routes/adminRoute.js';
import partnerRoute from './routes/partnerRoute.js';
import storeRoute from './routes/storeRoute.js';
import itemRoute from './routes/itemRoute.js';
import orderRoute from './routes/orderRoute.js';

dotenv.config();
connectDB();

const app = express();
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
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
