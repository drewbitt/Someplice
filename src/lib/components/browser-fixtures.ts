import { beforeEach, vi } from 'vitest';
import type { Goal, Intention } from '#lib/trpc/types.js';
import '../../app.css';

export const api = {
	goalLogs: vi.fn(),
	uniqueDates: vi.fn(),
	deleteGoal: vi.fn(),
	updateGoals: vi.fn(),
	addGoal: vi.fn(),
	listGoals: vi.fn(),
	list: vi.fn(),
	goalsOnDate: vi.fn(),
	priorities: vi.fn(),
	saveReview: vi.fn(),
	savePriority: vi.fn(),
	setStatus: vi.fn(),
	updateIntentions: vi.fn(),
	refresh: vi.fn()
};
export const navigation = { refreshAll: api.refresh, beforeNavigate: vi.fn() };
export const client = {
	goal_logs: { getAllForGoal: { query: api.goalLogs } },
	goals: {
		add: { mutate: api.addGoal },
		list: { query: api.listGoals },
		delete: { mutate: api.deleteGoal },
		updateGoals: { mutate: api.updateGoals },
		listGoalsOnDate: { query: api.goalsOnDate }
	},
	intentions: {
		list: { query: api.list },
		listUniqueDates: { query: api.uniqueDates },
		setStatus: { mutate: api.setStatus },
		updateIntentions: { mutate: api.updateIntentions }
	},
	priorities: { list: { query: api.priorities }, upsert: { mutate: api.savePriority } },
	outcomes: { saveReview: { mutate: api.saveReview } }
};

export const goal: Goal = {
	id: 1,
	active: 1,
	orderNumber: 1,
	title: 'Read',
	description: '',
	color: 'navy'
};
export const intention: Intention = {
	id: 1,
	goalId: 1,
	orderNumber: 1,
	text: 'Read a chapter',
	status: 'pending',
	subIntentionQualifier: null,
	date: '2026-10-01T12:00:00.000Z'
};

beforeEach(() => {
	vi.resetAllMocks();
	api.goalLogs.mockResolvedValue([]);
	api.uniqueDates.mockResolvedValue([]);
	api.deleteGoal.mockRejectedValue(new Error('Offline'));
	api.addGoal.mockResolvedValue({ id: 2 });
	api.listGoals.mockResolvedValue([goal]);
	api.list.mockResolvedValue([]);
	api.goalsOnDate.mockImplementation(({ active }) => Promise.resolve(active === 0 ? [] : [goal]));
	api.priorities.mockResolvedValue([]);
	api.saveReview.mockResolvedValue({ id: 1 });
	api.savePriority.mockResolvedValue({ id: 1 });
	api.refresh.mockResolvedValue(undefined);
});
