from workforce import Workforce, Toolkit, Agent, Subtask, TaskStatus


class SumTool:
    name = "sum"

    def run(self, **kwargs):
        return kwargs["a"] + kwargs["b"]


class FailTool:
    name = "fail"

    def run(self, **kwargs):
        raise RuntimeError("boom")


class MarkerTool:
    name = "mark"

    def run(self, **kwargs):
        kwargs["calls"].append(kwargs["name"])
        return kwargs["name"]


def router(_subtask: Subtask):
    return "main"


def test_workforce_dependency_chain_a_to_b_to_c():
    toolkit = Toolkit()
    toolkit.register(SumTool())

    task_a = Subtask(id="A", description="a", tool_name="sum", params={"a": 1, "b": 1})
    task_b = Subtask(id="B", description="b", tool_name="sum", params={"a": 2, "b": 2}, depends_on=["A"])
    task_c = Subtask(id="C", description="c", tool_name="sum", params={"a": 3, "b": 3}, depends_on=["B"])

    workforce = Workforce(
        planner=lambda _: [task_a, task_b, task_c],
        agents={"main": Agent(name="main", toolkit=toolkit)},
        task_router=router,
    )

    result = workforce.execute(task_id="t-chain", objective="run")

    assert result.status == TaskStatus.COMPLETED
    assert [t.status for t in result.subtasks] == [
        TaskStatus.COMPLETED,
        TaskStatus.COMPLETED,
        TaskStatus.COMPLETED,
    ]


def test_workforce_blocks_downstream_when_dependency_fails():
    toolkit = Toolkit()
    toolkit.register(FailTool())
    toolkit.register(SumTool())

    task_a = Subtask(id="A", description="a", tool_name="fail")
    task_b = Subtask(id="B", description="b", tool_name="sum", params={"a": 1, "b": 2}, depends_on=["A"])

    workforce = Workforce(
        planner=lambda _: [task_a, task_b],
        agents={"main": Agent(name="main", toolkit=toolkit)},
        task_router=router,
    )

    result = workforce.execute(task_id="t-fail", objective="run")

    assert result.status == TaskStatus.FAILED
    assert result.subtasks[0].status == TaskStatus.FAILED
    assert result.subtasks[1].status == TaskStatus.BLOCKED
    assert "Blocked by failed dependencies" in (result.subtasks[1].blocked_reason or "")


def test_workforce_runs_independent_tasks_without_blocking():
    toolkit = Toolkit()
    toolkit.register(MarkerTool())
    calls = []

    task_a = Subtask(id="A", description="a", tool_name="mark", params={"calls": calls, "name": "A"})
    task_b = Subtask(id="B", description="b", tool_name="mark", params={"calls": calls, "name": "B"})

    workforce = Workforce(
        planner=lambda _: [task_a, task_b],
        agents={"main": Agent(name="main", toolkit=toolkit)},
        task_router=router,
    )

    result = workforce.execute(task_id="t-parallel", objective="run")

    assert result.status == TaskStatus.COMPLETED
    assert set(calls) == {"A", "B"}
    assert all(task.status == TaskStatus.COMPLETED for task in result.subtasks)
