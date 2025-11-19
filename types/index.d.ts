type Input = {
	word: string;
	decibels: number;
	confidence: number;
	pitch: number;
};

type Output = {
	sentiment: 'positive' | 'negative' | 'neutral';
	certainty: number;
	action: 'hold' | 'end' | 'intervene';
	message: string;
};

export { Input, Output };