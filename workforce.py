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
        if any(st.status == TaskStatus.FAILED for st in self.subtasks):
            return TaskStatus.FAILED
        if all(st.status == TaskStatus.COMPLETED for st in self.subtasks):
            return TaskStatus.COMPLETED
        if any(st.status == TaskStatus.RUNNING for st in self.subtasks):
            return TaskStatus.RUNNING
        return TaskStatus.PENDING


Planner = Callable[[str], List[Subtask]]


@dataclass
class Workforce:
    planner: Planner
    agents: Dict[str, Agent]
    task_router: Callable[[Subtask], str]

    def execute(self, task_id: str, objective: str) -> WorkforceExecution:
        subtasks = self.planner(objective)
        execution = WorkforceExecution(task_id=task_id, subtasks=subtasks)

        for subtask in execution.subtasks:
            agent_name = self.task_router(subtask)
            if agent_name not in self.agents:
                subtask.status = TaskStatus.FAILED
                subtask.error = f"Agent '{agent_name}' not found"
                continue
            self.agents[agent_name].execute_subtask(subtask)

        return execution
