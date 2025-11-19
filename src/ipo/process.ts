import { configDotenv } from 'dotenv';
configDotenv();

import fs from 'fs';
import path from 'path';

import OpenAI from 'openai';

import type { Input, Output } from '../../types/index.js';

const openai = new OpenAI({
	apiKey: process.env.ALIBABA_API_KEY,
	baseURL: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'
});

const process_prompt = fs.readFileSync(path.join(process.cwd(), 'prompts', 'process.md'), 'utf-8');

const _process = async (data: Input[]): Promise<Output[]> => {
	const response = await openai.chat.completions.create({
		model: 'qwen-plus',
		messages: [
			{
				role: 'system',
				content: process_prompt,
			},
			{
				role: 'user',
				content: JSON.stringify(data)
			}
		]
	});
	const output: Output[] = JSON.parse(response.choices[0].message.content);
	console.log(response.choices[0].message.content);
	return output;
};

export default _process;