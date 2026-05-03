from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Callable, Dict, List, Optional, Protocol, Any
import uuid


class TaskStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    BLOCKED = "blocked"


class Tool(Protocol):
    name: str

    def run(self, **kwargs: Any) -> Any:
        ...


@dataclass
class Toolkit:
    tools: Dict[str, Tool] = field(default_factory=dict)

    def register(self, tool: Tool) -> None:
        self.tools[tool.name] = tool

    def execute(self, tool_name: str, **kwargs: Any) -> Any:
        if tool_name not in self.tools:
            raise ValueError(f"Tool '{tool_name}' not available")
        return self.tools[tool_name].run(**kwargs)


@dataclass
class Subtask:
    description: str
    tool_name: str
    params: Dict[str, Any] = field(default_factory=dict)
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    depends_on: List[str] = field(default_factory=list)
    blocked_reason: str | None = None
    status: TaskStatus = TaskStatus.PENDING
    output: Optional[Any] = None
    error: Optional[str] = None


@dataclass
class Agent:
    name: str
    toolkit: Toolkit

    def execute_subtask(self, task: Subtask) -> Subtask:
        task.status = TaskStatus.RUNNING
        try:
            task.output = self.toolkit.execute(task.tool_name, **task.params)
            task.status = TaskStatus.COMPLETED
        except Exception as exc:  # noqa: BLE001
            task.status = TaskStatus.FAILED
            task.error = str(exc)
        return task


@dataclass
class WorkforceExecution:
    task_id: str
    subtasks: List[Subtask]

    @property
    def status(self) -> TaskStatus:
        if all(st.status == TaskStatus.COMPLETED for st in self.subtasks):
            return TaskStatus.COMPLETED
        if any(st.status == TaskStatus.RUNNING for st in self.subtasks):
            return TaskStatus.RUNNING
        if any(st.status == TaskStatus.PENDING for st in self.subtasks):
            return TaskStatus.PENDING
        if any(st.status == TaskStatus.FAILED for st in self.subtasks):
            return TaskStatus.FAILED
        return TaskStatus.BLOCKED


Planner = Callable[[str], List[Subtask]]


@dataclass
class Workforce:
    planner: Planner
    agents: Dict[str, Agent]
    task_router: Callable[[Subtask], str]

    def execute(self, task_id: str, objective: str) -> WorkforceExecution:
        subtasks = self.planner(objective)
        execution = WorkforceExecution(task_id=task_id, subtasks=subtasks)
        subtask_map = {subtask.id: subtask for subtask in execution.subtasks}

        while True:
            made_progress = False

            for subtask in execution.subtasks:
                if subtask.status != TaskStatus.PENDING:
                    continue

                if any(dep_id not in subtask_map for dep_id in subtask.depends_on):
                    missing = [dep_id for dep_id in subtask.depends_on if dep_id not in subtask_map]
                    subtask.status = TaskStatus.BLOCKED
                    subtask.blocked_reason = f"Missing dependencies: {', '.join(missing)}"
                    made_progress = True
                    continue

                deps = [subtask_map[dep_id] for dep_id in subtask.depends_on]
                if any(dep.status == TaskStatus.FAILED for dep in deps):
                    failed_deps = [dep.id for dep in deps if dep.status == TaskStatus.FAILED]
                    subtask.status = TaskStatus.BLOCKED
                    subtask.blocked_reason = f"Blocked by failed dependencies: {', '.join(failed_deps)}"
                    made_progress = True
                    continue

                if any(dep.status == TaskStatus.BLOCKED for dep in deps):
                    blocked_deps = [dep.id for dep in deps if dep.status == TaskStatus.BLOCKED]
                    subtask.status = TaskStatus.BLOCKED
                    subtask.blocked_reason = f"Blocked by blocked dependencies: {', '.join(blocked_deps)}"
                    made_progress = True
                    continue

                if not all(dep.status == TaskStatus.COMPLETED for dep in deps):
                    continue

                agent_name = self.task_router(subtask)
                if agent_name not in self.agents:
                    subtask.status = TaskStatus.FAILED
                    subtask.error = f"Agent '{agent_name}' not found"
                else:
                    self.agents[agent_name].execute_subtask(subtask)
                made_progress = True

            if not made_progress:
                break

        return execution
