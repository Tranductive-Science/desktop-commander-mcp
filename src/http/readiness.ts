export interface ReadinessState {
    tasks: string[];
    tasksDone: number;
    startTime: number;
    ready: boolean;
}

export function createReadinessState(tasks: string[]): ReadinessState {
    return { tasks: [...tasks], tasksDone: 0, startTime: Date.now(), ready: tasks.length === 0 };
}

export function completeReadinessTask(state: ReadinessState): void {
    state.tasksDone = Math.min(state.tasks.length, state.tasksDone + 1);
    state.ready = state.tasksDone >= state.tasks.length;
}

export function readinessPayload(state: ReadinessState): { status: string; warmup?: object } {
    const outstanding = state.tasks.length - state.tasksDone;
    const warmup = state.tasks.length > 0 ? {
        warmup: {
            tasksTotal: state.tasks.length,
            tasksDone: state.tasksDone,
            tasks: state.tasks,
            time: Date.now() - state.startTime,
        },
    } : {};
    return {
        status: outstanding > 0 ? `Await ready for ${outstanding} of ${state.tasks.length} tasks` : 'Ready',
        ...warmup,
    };
}
