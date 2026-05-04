from workforce import Workforce, Toolkit, Agent, Subtask, TaskStatus, HookResult, ExecutionMode


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


class TeamPublishTool:
    name = "team_publish"

    def run(self, **kwargs):
        team_context = kwargs.get("team_context")
        if team_context is not None:
            team_context.publish(sender=kwargs["sender"], content=kwargs["content"])
            return len(team_context.read_all())
        return 0


class TeamReadTool:
    name = "team_read"

    def run(self, **kwargs):
        team_context = kwargs.get("team_context")
        if team_context is None:
            return []
        return [message["content"] for message in team_context.read_all()]


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


def test_on_task_created_allows_and_rejects_subtasks():
    toolkit = Toolkit()
    toolkit.register(MarkerTool())
    calls = []

    allowed = Subtask(id="A", description="allow", tool_name="mark", params={"calls": calls, "name": "A"})
    rejected = Subtask(id="B", description="reject", tool_name="mark", params={"calls": calls, "name": "B"})

    def on_task_created(subtask: Subtask) -> HookResult:
        if subtask.id == "B":
            return HookResult(allow=False, message="policy blocked")
        return HookResult(allow=True, message="ok")

    workforce = Workforce(
        planner=lambda _: [allowed, rejected],
        agents={"main": Agent(name="main", toolkit=toolkit)},
        task_router=router,
        on_task_created=on_task_created,
    )

    result = workforce.execute(task_id="t-created", objective="run")

    assert len(result.subtasks) == 1
    assert result.subtasks[0].id == "A"
    assert result.subtasks[0].metadata["on_task_created"]["allow"] is True
    assert calls == ["A"]
    assert rejected.error == "policy blocked"


def test_on_task_completed_rejection_to_failed_or_pending():
    toolkit = Toolkit()
    toolkit.register(SumTool())

    def deny(_subtask: Subtask) -> HookResult:
        return HookResult(allow=False, message="post-check failed")

    failed_task = Subtask(id="F", description="f", tool_name="sum", params={"a": 1, "b": 2})
    workforce_failed = Workforce(
        planner=lambda _: [failed_task],
        agents={"main": Agent(name="main", toolkit=toolkit)},
        task_router=router,
        on_task_completed=deny,
        on_task_completed_rejection_status=TaskStatus.FAILED,
    )
    failed_result = workforce_failed.execute(task_id="t-complete-failed", objective="run")
    assert failed_result.subtasks[0].status == TaskStatus.FAILED
    assert failed_result.subtasks[0].error == "post-check failed"
    assert failed_result.subtasks[0].metadata["on_task_completed"]["allow"] is False

    pending_task = Subtask(id="P", description="p", tool_name="sum", params={"a": 2, "b": 3})
    workforce_pending = Workforce(
        planner=lambda _: [pending_task],
        agents={"main": Agent(name="main", toolkit=toolkit)},
        task_router=router,
        on_task_completed=deny,
        on_task_completed_rejection_status=TaskStatus.PENDING,
    )
    pending_result = workforce_pending.execute(task_id="t-complete-pending", objective="run")
    assert pending_result.subtasks[0].status == TaskStatus.PENDING
    assert pending_result.subtasks[0].error == "post-check failed"
    assert pending_result.subtasks[0].metadata["on_task_completed"]["message"] == "post-check failed"


def test_execution_mode_subagent_keeps_isolated_behavior():
    toolkit = Toolkit()
    toolkit.register(TeamPublishTool())
    toolkit.register(TeamReadTool())

    publish = Subtask(
        id="A",
        description="publish",
        tool_name="team_publish",
        params={"sender": "agent-a", "content": "hello"},
    )
    read = Subtask(id="B", description="read", tool_name="team_read", depends_on=["A"])

    workforce = Workforce(
        planner=lambda _: [publish, read],
        agents={"main": Agent(name="main", toolkit=toolkit)},
        task_router=router,
        execution_mode=ExecutionMode.SUBAGENT,
    )

    result = workforce.execute(task_id="t-subagent", objective="run")

    assert result.mode == ExecutionMode.SUBAGENT
    assert read.output == []
    assert all(event["type"] != "team_context_shared" for event in result.events)


def test_execution_mode_team_shares_context_and_records_events():
    toolkit = Toolkit()
    toolkit.register(TeamPublishTool())
    toolkit.register(TeamReadTool())

    publish = Subtask(
        id="A",
        description="publish",
        tool_name="team_publish",
        params={"sender": "agent-a", "content": "hello"},
    )
    read = Subtask(id="B", description="read", tool_name="team_read", depends_on=["A"])

    workforce = Workforce(
        planner=lambda _: [publish, read],
        agents={"main": Agent(name="main", toolkit=toolkit)},
        task_router=router,
        execution_mode=ExecutionMode.TEAM,
    )

    result = workforce.execute(task_id="t-team", objective="run")

    assert result.mode == ExecutionMode.TEAM
    assert read.output == ["hello"]
    assert any(event["type"] == "team_context_shared" for event in result.events)
    assert result.events[0] == {"type": "execution_started", "mode": "team"}
    assert result.events[-1]["type"] == "execution_finished"
