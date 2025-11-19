import express, { response } from 'express';
import { createServer } from 'http';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { WebSocketServer } from 'ws';

const app = express();
const server = createServer(app);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());
app.use(cors({
	origin: '*',
	methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
	allowedHeaders: ['Content-Type']
}));

const PORT = process.env.PORT || 3000;

import word from './routes/word.js';
app.use('/word', word);

app.get('/', (req, res) => {
	res.send('Hello, World!');
});

server.listen(PORT, () => {
	console.log(`Server is running on http://localhost:${PORT}`);
});