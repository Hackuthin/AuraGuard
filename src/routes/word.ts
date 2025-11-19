import express from 'express';

import type { Input, Output } from '../../types/index.js';

const router = express.Router();

import _process from '../ipo/process.js';

router.post('/', (req, res) => {
	const data: Input[] = req.body;
	if (!data)
		return res.status(400).json({ error: 'No data provided' });

	const result: Output[] = _process(data);

	return res.json(result);
});

export default router;