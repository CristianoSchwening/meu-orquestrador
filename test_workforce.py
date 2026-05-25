from workforce import (
    Workforce,
    Toolkit,
    Agent,
    Subtask,
    TaskStatus,
    HookResult,
    ExecutionMode,
    ExecutionPattern,
    ExecutionBudget,
    CriticResult,
    RouterContext,
    TaskBoard,
    least_loaded_router,
)
from threading import Thread, Lock
import time
import pytest
from datetime import datetime


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


class SlowMarkerTool:
    name = "slow_mark"

    def run(self, **kwargs):
        time.sleep(kwargs.get("delay", 0.05))
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
    assert {task.output for task in result.subtasks} == {"A", "B"}
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
    assert result.subtasks[0].output == "A"
    assert rejected.error is None


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
    assert result.subtasks[1].output == []
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
    assert result.subtasks[1].output == ["hello"]
    assert any(event["type"] == "team_context_shared" for event in result.events)
    assert result.events[0]["type"] == "execution_started"
    assert result.events[0]["mode"] == "team"
    assert result.events[0]["pattern"] == "sequential"
    assert result.events[-1]["type"] == "execution_finished"
    assert result.events[0]["seq"] == 1
    assert result.events[-1]["seq"] == len(result.events)
    assert [event["seq"] for event in result.events] == list(range(1, len(result.events) + 1))
    assert all(event["task_id"] == "t-team" for event in result.events)
    assert all("ts" in event for event in result.events)
    for event in result.events:
        parsed = datetime.fromisoformat(event["ts"].replace("Z", "+00:00"))
        assert parsed.tzinfo is not None


def test_taskboard_claim_next_thread_safe_prevents_double_claim():
    subtasks = [Subtask(id="A", description="a", tool_name="sum")]
    board = TaskBoard(subtasks)
    claims = []
    claims_lock = Lock()

    def worker(agent_name: str):
        claimed = board.claim_next(agent_name)
        with claims_lock:
            claims.append((agent_name, claimed.id if claimed else None))

    threads = [Thread(target=worker, args=(f"agent-{i}",)) for i in range(10)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    claimed_ids = [claim_id for _, claim_id in claims if claim_id is not None]
    assert claimed_ids == ["A"]
    assert subtasks[0].claimed_by is not None
    assert subtasks[0].claimed_at is not None


def test_taskboard_claim_flow_avoids_double_execution_multithread():
    task_a = Subtask(id="A", description="a", tool_name="sum", params={"a": 1, "b": 1})
    task_b = Subtask(id="B", description="b", tool_name="sum", params={"a": 2, "b": 2})
    for task in (task_a, task_b):
        task.metadata["routed_agent"] = "main"

    board = TaskBoard([task_a, task_b])
    toolkit = Toolkit()
    toolkit.register(SumTool())
    agent = Agent(name="main", toolkit=toolkit)
    executed = []
    executed_lock = Lock()

    def worker():
        while True:
            subtask = board.claim_next("main")
            if subtask is None:
                return
            time.sleep(0.01)
            agent.execute_subtask(subtask)
            with executed_lock:
                executed.append(subtask.id)

    threads = [Thread(target=worker) for _ in range(4)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert sorted(executed) == ["A", "B"]
    assert len(executed) == 2
    assert task_a.status == TaskStatus.COMPLETED
    assert task_b.status == TaskStatus.COMPLETED


def test_decision_metadata_sequential_plan_recommends_single_agent():
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

    result = workforce.execute(task_id="t-meta-seq", objective="run")

    assert result.decision_metadata["recommended_agents"] == 1
    assert result.decision_metadata["parallelism_worth_it"] is False
    assert result.decision_metadata["dependency_depth"] == 3


def test_decision_metadata_parallel_plan_recommends_more_agents():
    toolkit = Toolkit()
    toolkit.register(MarkerTool())
    calls = []

    workforce = Workforce(
        planner=lambda _: [
            Subtask(id="A", description="a", tool_name="mark", params={"calls": calls, "name": "A"}),
            Subtask(id="B", description="b", tool_name="mark", params={"calls": calls, "name": "B"}),
            Subtask(id="C", description="c", tool_name="mark", params={"calls": calls, "name": "C"}),
        ],
        agents={
            "a1": Agent(name="a1", toolkit=toolkit),
            "a2": Agent(name="a2", toolkit=toolkit),
            "a3": Agent(name="a3", toolkit=toolkit),
        },
        task_router=lambda subtask: {"A": "a1", "B": "a2", "C": "a3"}[subtask.id],
    )

    result = workforce.execute(task_id="t-meta-par", objective="run")

    assert result.decision_metadata["recommended_agents"] >= 2
    assert result.decision_metadata["parallelism_worth_it"] is True
    assert result.decision_metadata["independent_subtasks"] == 3


def test_execution_pattern_parallel_runs_independent_tasks_concurrently():
    toolkit = Toolkit()
    toolkit.register(SlowMarkerTool())
    calls = []
    order = []

    def slow_router(subtask: Subtask) -> str:
        return subtask.id.lower()

    workforce = Workforce(
        planner=lambda _: [
            Subtask(id="A", description="a", tool_name="slow_mark", params={"calls": calls, "name": "A", "delay": 0.05}),
            Subtask(id="B", description="b", tool_name="slow_mark", params={"calls": calls, "name": "B", "delay": 0.05}),
            Subtask(id="C", description="c", tool_name="slow_mark", params={"calls": calls, "name": "C", "delay": 0.05}),
        ],
        agents={
            "a": Agent(name="a", toolkit=toolkit),
            "b": Agent(name="b", toolkit=toolkit),
            "c": Agent(name="c", toolkit=toolkit),
        },
        task_router=slow_router,
        execution_pattern=ExecutionPattern.PARALLEL,
    )

    t0 = time.time()
    result = workforce.execute(task_id="t-parallel-pattern", objective="run")
    elapsed = time.time() - t0

    assert result.status == TaskStatus.COMPLETED
    assert {task.output for task in result.subtasks} == {"A", "B", "C"}
    assert elapsed < 0.25, "Parallel tasks should finish faster than sequential (3 * 0.05s)"
    assert result.events[0]["pattern"] == "parallel"


def test_execution_pattern_review_critic_approves_on_pass():
    toolkit = Toolkit()
    toolkit.register(SumTool())

    def approving_critic(subtask: Subtask) -> CriticResult:
        return CriticResult(approved=True, score=1.0, feedback="looks good")

    workforce = Workforce(
        planner=lambda _: [Subtask(id="A", description="a", tool_name="sum", params={"a": 2, "b": 3})],
        agents={"main": Agent(name="main", toolkit=toolkit)},
        task_router=router,
        execution_pattern=ExecutionPattern.REVIEW_CRITIC,
        critic=approving_critic,
    )

    result = workforce.execute(task_id="t-critic-pass", objective="run")

    assert result.status == TaskStatus.COMPLETED
    assert result.subtasks[0].output == 5
    assert result.subtasks[0].quality_score == 1.0
    assert result.subtasks[0].critic_feedback == "looks good"
    assert result.subtasks[0].metadata["critic"]["approved"] is True
    assert result.metrics["critic_rejections"] == 0


def test_execution_pattern_review_critic_retries_on_rejection_then_exhausts():
    toolkit = Toolkit()
    toolkit.register(SumTool())
    critic_calls = []

    def always_reject(subtask: Subtask) -> CriticResult:
        critic_calls.append(subtask.id)
        return CriticResult(approved=False, score=0.2, feedback="not good enough")

    workforce = Workforce(
        planner=lambda _: [Subtask(id="A", description="a", tool_name="sum", params={"a": 1, "b": 1})],
        agents={"main": Agent(name="main", toolkit=toolkit)},
        task_router=router,
        execution_pattern=ExecutionPattern.REVIEW_CRITIC,
        critic=always_reject,
        budget=ExecutionBudget(max_iterations=2),
    )

    result = workforce.execute(task_id="t-critic-exhaust", objective="run")

    assert result.subtasks[0].status == TaskStatus.FAILED
    assert "Critic rejected after" in (result.subtasks[0].error or "")
    assert result.metrics["critic_rejections"] >= 1
    assert result.subtasks[0].attempt == 2
    retry_events = [e for e in result.events if e["type"] == "subtask_retry"]
    assert len(retry_events) == 2


def test_execution_pattern_review_critic_quality_threshold_auto_approves():
    toolkit = Toolkit()
    toolkit.register(SumTool())

    def borderline_critic(subtask: Subtask) -> CriticResult:
        return CriticResult(approved=False, score=0.8, feedback="borderline")

    workforce = Workforce(
        planner=lambda _: [Subtask(id="A", description="a", tool_name="sum", params={"a": 1, "b": 1})],
        agents={"main": Agent(name="main", toolkit=toolkit)},
        task_router=router,
        execution_pattern=ExecutionPattern.REVIEW_CRITIC,
        critic=borderline_critic,
        budget=ExecutionBudget(quality_threshold=0.75),
    )

    result = workforce.execute(task_id="t-critic-threshold", objective="run")

    assert result.status == TaskStatus.COMPLETED
    assert result.subtasks[0].quality_score == 0.8
    assert result.metrics["critic_rejections"] == 0


def test_execution_pattern_iterative_refinement_cycles_until_approved():
    toolkit = Toolkit()
    toolkit.register(SumTool())
    calls = [0]

    def improving_critic(subtask: Subtask) -> CriticResult:
        calls[0] += 1
        if calls[0] < 3:
            return CriticResult(approved=False, score=0.4, feedback="needs improvement")
        return CriticResult(approved=True, score=1.0, feedback="approved")

    workforce = Workforce(
        planner=lambda _: [Subtask(id="A", description="a", tool_name="sum", params={"a": 1, "b": 1})],
        agents={"main": Agent(name="main", toolkit=toolkit)},
        task_router=router,
        execution_pattern=ExecutionPattern.ITERATIVE_REFINEMENT,
        critic=improving_critic,
        budget=ExecutionBudget(max_iterations=5),
    )

    result = workforce.execute(task_id="t-iterative", objective="run")

    assert result.status == TaskStatus.COMPLETED
    assert result.metrics["iterations"] > 0
    refinement_events = [e for e in result.events if e["type"] == "refinement_cycle"]
    assert len(refinement_events) >= 1


def test_execution_pattern_iterative_refinement_stops_at_max_iterations():
    toolkit = Toolkit()
    toolkit.register(SumTool())

    def always_reject(subtask: Subtask) -> CriticResult:
        return CriticResult(approved=False, score=0.1, feedback="never good")

    workforce = Workforce(
        planner=lambda _: [Subtask(id="A", description="a", tool_name="sum", params={"a": 1, "b": 1})],
        agents={"main": Agent(name="main", toolkit=toolkit)},
        task_router=router,
        execution_pattern=ExecutionPattern.ITERATIVE_REFINEMENT,
        critic=always_reject,
        budget=ExecutionBudget(max_iterations=2),
    )

    result = workforce.execute(task_id="t-iterative-max", objective="run")

    assert any(e["type"] == "max_iterations_reached" for e in result.events)
    assert result.metrics["iterations"] == 2


def test_execution_pattern_human_in_the_loop_approves():
    toolkit = Toolkit()
    toolkit.register(SumTool())

    workforce = Workforce(
        planner=lambda _: [Subtask(id="A", description="a", tool_name="sum", params={"a": 3, "b": 4})],
        agents={"main": Agent(name="main", toolkit=toolkit)},
        task_router=router,
        execution_pattern=ExecutionPattern.HUMAN_IN_THE_LOOP,
        human_approval_gate=lambda _: True,
    )

    result = workforce.execute(task_id="t-human-approve", objective="run")

    assert result.status == TaskStatus.COMPLETED
    assert result.subtasks[0].metadata["human_approval"]["approved"] is True
    assert any(e["type"] == "subtask_human_approved" for e in result.events)


def test_execution_pattern_human_in_the_loop_rejects():
    toolkit = Toolkit()
    toolkit.register(SumTool())

    workforce = Workforce(
        planner=lambda _: [Subtask(id="A", description="a", tool_name="sum", params={"a": 3, "b": 4})],
        agents={"main": Agent(name="main", toolkit=toolkit)},
        task_router=router,
        execution_pattern=ExecutionPattern.HUMAN_IN_THE_LOOP,
        human_approval_gate=lambda _: False,
    )

    result = workforce.execute(task_id="t-human-reject", objective="run")

    assert result.subtasks[0].status == TaskStatus.FAILED
    assert result.subtasks[0].error == "Rejected by human approval gate"
    assert any(e["type"] == "subtask_human_rejected" for e in result.events)


def test_budget_max_model_calls_stops_execution():
    toolkit = Toolkit()
    toolkit.register(SumTool())

    workforce = Workforce(
        planner=lambda _: [
            Subtask(id="A", description="a", tool_name="sum", params={"a": 1, "b": 1}),
            Subtask(id="B", description="b", tool_name="sum", params={"a": 2, "b": 2}),
            Subtask(id="C", description="c", tool_name="sum", params={"a": 3, "b": 3}),
        ],
        agents={"main": Agent(name="main", toolkit=toolkit)},
        task_router=router,
        budget=ExecutionBudget(max_model_calls=1),
    )

    result = workforce.execute(task_id="t-budget-calls", objective="run")

    assert result.metrics["model_calls"] <= 1
    assert any(e["type"] == "budget_exceeded" for e in result.events)


def test_budget_max_elapsed_ms_stops_execution():
    toolkit = Toolkit()
    toolkit.register(SlowMarkerTool())
    calls = []

    workforce = Workforce(
        planner=lambda _: [
            Subtask(id="A", description="a", tool_name="slow_mark", params={"calls": calls, "name": "A", "delay": 0.2}),
            Subtask(id="B", description="b", tool_name="slow_mark", params={"calls": calls, "name": "B", "delay": 0.2}),
        ],
        agents={"main": Agent(name="main", toolkit=toolkit)},
        task_router=router,
        budget=ExecutionBudget(max_elapsed_ms=150),
    )

    result = workforce.execute(task_id="t-budget-elapsed", objective="run")

    assert any(e["type"] == "budget_exceeded" for e in result.events)
    assert len(calls) <= 1


def test_metrics_track_latency_and_model_calls():
    toolkit = Toolkit()
    toolkit.register(SumTool())

    task_a = Subtask(id="A", description="a", tool_name="sum", params={"a": 1, "b": 1})
    task_b = Subtask(id="B", description="b", tool_name="sum", params={"a": 2, "b": 2})

    workforce = Workforce(
        planner=lambda _: [task_a, task_b],
        agents={"main": Agent(name="main", toolkit=toolkit)},
        task_router=router,
    )

    result = workforce.execute(task_id="t-metrics", objective="run")

    assert result.metrics["model_calls"] == 2
    assert result.metrics["total_elapsed_ms"] >= 0
    assert "A" in result.metrics["subtask_latencies"]
    assert "B" in result.metrics["subtask_latencies"]
    assert result.metrics["subtask_latencies"]["A"] >= 0


def test_subtask_tracks_attempt_and_timing_fields():
    toolkit = Toolkit()
    toolkit.register(SumTool())

    subtask = Subtask(id="A", description="a", tool_name="sum", params={"a": 1, "b": 1})

    assert subtask.attempt == 0
    assert subtask.quality_score is None
    assert subtask.critic_feedback is None
    assert subtask.started_at is None
    assert subtask.completed_at is None

    workforce = Workforce(
        planner=lambda _: [subtask],
        agents={"main": Agent(name="main", toolkit=toolkit)},
        task_router=router,
    )

    result = workforce.execute(task_id="t-fields", objective="run")

    assert result.subtasks[0].started_at is not None
    assert result.subtasks[0].completed_at is not None
    assert result.subtasks[0].completed_at >= result.subtasks[0].started_at


def test_agent_max_concurrent_limits_parallel_claims():
    toolkit = Toolkit()
    toolkit.register(SlowMarkerTool())
    calls = []
    concurrent_peak = [0]
    concurrent_now = [0]
    concurrent_lock = Lock()

    class TrackingTool:
        name = "track"

        def run(self, **kwargs):
            with concurrent_lock:
                concurrent_now[0] += 1
                if concurrent_now[0] > concurrent_peak[0]:
                    concurrent_peak[0] = concurrent_now[0]
            time.sleep(0.05)
            with concurrent_lock:
                concurrent_now[0] -= 1
            calls.append(kwargs["name"])
            return kwargs["name"]

    tracking_toolkit = Toolkit()
    tracking_toolkit.register(TrackingTool())

    tasks = [
        Subtask(id=str(i), description=f"t{i}", tool_name="track", params={"name": str(i)})
        for i in range(4)
    ]

    workforce = Workforce(
        planner=lambda _: tasks,
        agents={
            "worker": Agent(name="worker", toolkit=tracking_toolkit, max_concurrent=1),
        },
        task_router=lambda _: "worker",
        execution_pattern=ExecutionPattern.PARALLEL,
    )

    result = workforce.execute(task_id="t-max-concurrent", objective="run")

    assert result.status == TaskStatus.COMPLETED
    assert len(calls) == 4
    assert concurrent_peak[0] == 1, "max_concurrent=1 must prevent more than one simultaneous run"


def test_capacity_fallback_reroutes_task_when_preferred_agent_at_capacity():
    slow_toolkit = Toolkit()
    claim_order = []
    claim_lock = Lock()

    class SlowSumTool:
        name = "slow_sum"

        def run(self, **kwargs):
            time.sleep(0.08)
            return kwargs["a"] + kwargs["b"]

    slow_toolkit.register(SlowSumTool())

    class RecordingAgent(Agent):
        def execute_subtask(self, task):
            with claim_lock:
                claim_order.append(self.name)
            return super().execute_subtask(task)

    tasks = [
        Subtask(id="X", description="x", tool_name="slow_sum", params={"a": 1, "b": 2}),
        Subtask(id="Y", description="y", tool_name="slow_sum", params={"a": 3, "b": 4}),
    ]

    workforce = Workforce(
        planner=lambda _: tasks,
        agents={
            "a": RecordingAgent(name="a", toolkit=slow_toolkit, max_concurrent=1),
            "b": RecordingAgent(name="b", toolkit=slow_toolkit, max_concurrent=1),
        },
        task_router=lambda _: "a",
        execution_pattern=ExecutionPattern.PARALLEL,
    )

    result = workforce.execute(task_id="t-fallback", objective="run")

    assert result.status == TaskStatus.COMPLETED
    assert set(claim_order) == {"a", "b"}, "Agent b should handle task Y while a is busy with X"


def test_dynamic_router_reroutes_pending_subtasks():
    toolkit = Toolkit()
    toolkit.register(MarkerTool())
    calls = []
    routed_to = {}

    def static_router(subtask):
        return "a"

    def dynamic(subtask, context):
        if subtask.id == "B":
            return "b"
        return "a"

    class RecordingAgent(Agent):
        def execute_subtask(self, task):
            routed_to[task.id] = self.name
            return super().execute_subtask(task)

    workforce = Workforce(
        planner=lambda _: [
            Subtask(id="A", description="a", tool_name="mark", params={"calls": calls, "name": "A"}),
            Subtask(id="B", description="b", tool_name="mark", params={"calls": calls, "name": "B"}),
        ],
        agents={
            "a": RecordingAgent(name="a", toolkit=toolkit),
            "b": RecordingAgent(name="b", toolkit=toolkit),
        },
        task_router=static_router,
        dynamic_router=dynamic,
    )

    result = workforce.execute(task_id="t-dynamic-router", objective="run")

    assert result.status == TaskStatus.COMPLETED
    assert routed_to.get("A") == "a"
    assert routed_to.get("B") == "b"
    rerouted = [e for e in result.events if e["type"] == "subtask_rerouted"]
    assert any(e["subtask_id"] == "B" and e["to_agent"] == "b" for e in rerouted)


def test_dynamic_router_receives_correct_context_fields():
    toolkit = Toolkit()
    toolkit.register(SumTool())
    captured_contexts = []

    def capturing_dynamic_router(subtask, context):
        captured_contexts.append(context)
        return "main"

    workforce = Workforce(
        planner=lambda _: [Subtask(id="A", description="a", tool_name="sum", params={"a": 1, "b": 1})],
        agents={"main": Agent(name="main", toolkit=toolkit, max_concurrent=2)},
        task_router=lambda _: "main",
        dynamic_router=capturing_dynamic_router,
    )

    result = workforce.execute(task_id="t-ctx-fields", objective="run")

    assert result.status == TaskStatus.COMPLETED
    assert len(captured_contexts) >= 1
    ctx = captured_contexts[0]
    assert isinstance(ctx, RouterContext)
    assert "main" in ctx.agent_capacities
    assert ctx.agent_capacities["main"] == 2
    assert isinstance(ctx.agent_loads, dict)
    assert isinstance(ctx.available_agents, list)


def test_least_loaded_router_selects_least_busy_agent():
    context = RouterContext(
        agent_loads={"a": 3, "b": 1, "c": 2},
        agent_capacities={"a": 5, "b": 5, "c": 5},
        available_agents=["a", "b", "c"],
    )
    subtask = Subtask(id="X", description="x", tool_name="sum")
    subtask.metadata["routed_agent"] = "a"

    result = least_loaded_router(subtask, context)
    assert result == "b", "Should pick the agent with load=1 (least loaded)"


def test_least_loaded_router_falls_back_when_no_available():
    context = RouterContext(
        agent_loads={"a": 1},
        agent_capacities={"a": 1},
        available_agents=[],
    )
    subtask = Subtask(id="X", description="x", tool_name="sum")

    result = least_loaded_router(subtask, context)
    assert result == "a", "Should fall back to least loaded from capacities when none available"


def test_least_loaded_router_works_end_to_end():
    routed_to = {}
    routed_lock = Lock()

    class SlowRecordTool:
        name = "slow_record"

        def run(self, **kwargs):
            time.sleep(kwargs.get("delay", 0.05))
            return kwargs["name"]

    slow_toolkit = Toolkit()
    slow_toolkit.register(SlowRecordTool())

    class RecordingAgent(Agent):
        def execute_subtask(self, task):
            with routed_lock:
                routed_to[task.id] = self.name
            return super().execute_subtask(task)

    workforce = Workforce(
        planner=lambda _: [
            Subtask(id="A", description="a", tool_name="slow_record", params={"name": "A", "delay": 0.1}),
            Subtask(id="B", description="b", tool_name="slow_record", params={"name": "B", "delay": 0.01}),
            Subtask(id="C", description="c", tool_name="slow_record", params={"name": "C", "delay": 0.01}),
        ],
        agents={
            "x": RecordingAgent(name="x", toolkit=slow_toolkit, max_concurrent=2),
            "y": RecordingAgent(name="y", toolkit=slow_toolkit, max_concurrent=2),
        },
        task_router=lambda _: "x",
        dynamic_router=least_loaded_router,
        execution_pattern=ExecutionPattern.PARALLEL,
    )

    result = workforce.execute(task_id="t-llr-e2e", objective="run")

    assert result.status == TaskStatus.COMPLETED
    assert set(routed_to.keys()) == {"A", "B", "C"}
    assert "y" in routed_to.values(), "least_loaded_router should spread tasks to agent y"


def test_reroute_event_emitted_on_route_change():
    toolkit = Toolkit()
    toolkit.register(SumTool())

    call_count = [0]

    def dynamic(subtask, context):
        call_count[0] += 1
        return "b"

    workforce = Workforce(
        planner=lambda _: [Subtask(id="T", description="t", tool_name="sum", params={"a": 1, "b": 2})],
        agents={
            "a": Agent(name="a", toolkit=toolkit),
            "b": Agent(name="b", toolkit=toolkit),
        },
        task_router=lambda _: "a",
        dynamic_router=dynamic,
    )

    result = workforce.execute(task_id="t-reroute-event", objective="run")

    assert result.status == TaskStatus.COMPLETED
    reroute_events = [e for e in result.events if e["type"] == "subtask_rerouted"]
    assert len(reroute_events) == 1
    assert reroute_events[0]["subtask_id"] == "T"
    assert reroute_events[0]["from_agent"] == "a"
    assert reroute_events[0]["to_agent"] == "b"

from ollama_tool import OllamaTool


def test_ollama_tool_uses_requester_and_returns_response():
    captured = {}

    def fake_requester(url: str, body: bytes, timeout_seconds: float):
        captured["url"] = url
        captured["body"] = body.decode("utf-8")
        captured["timeout"] = timeout_seconds
        return {"response": "ok-local-llm"}

    tool = OllamaTool(model="llama3.2:3b", requester=fake_requester)
    output = tool.run(prompt="Teste rápido")

    assert output == "ok-local-llm"
    assert captured["url"].endswith("/api/generate")
    assert '"model": "llama3.2:3b"' in captured["body"]


def test_ollama_tool_requires_non_empty_prompt():
    tool = OllamaTool(requester=lambda *_args, **_kwargs: {"response": "unused"})

    try:
        tool.run(prompt="")
        assert False, "esperava ValueError"
    except ValueError as exc:
        assert "prompt" in str(exc)


def test_execute_normalizes_subtasks_with_shared_params_reference():
    toolkit = Toolkit()
    toolkit.register(MarkerTool())

    shared_calls: list[str] = []
    shared_params = {"calls": shared_calls, "name": "first"}

    task_a = Subtask(id="A", description="a", tool_name="mark", params=shared_params)
    task_b = Subtask(id="B", description="b", tool_name="mark", params=shared_params)

    captured_ids: list[int] = []

    def on_task_created(subtask: Subtask) -> HookResult:
        captured_ids.append(id(subtask.params))
        if subtask.id == "A":
            subtask.params["name"] = "mutated-in-hook"
        return HookResult(allow=True)

    workforce = Workforce(
        planner=lambda _: [task_a, task_b],
        agents={"main": Agent(name="main", toolkit=toolkit)},
        task_router=router,
        on_task_created=on_task_created,
    )

    result = workforce.execute(task_id="t-normalize", objective="run")

    assert len(set(captured_ids)) == 2
    assert result.subtasks[0].params["name"] == "mutated-in-hook"
    assert result.subtasks[1].params["name"] == "first"
    assert task_a.params["name"] == "first"
    assert task_b.params["name"] == "first"


def test_consecutive_execute_calls_do_not_share_mutations_from_planner_subtasks():
    toolkit = Toolkit()
    toolkit.register(MarkerTool())

    planner_calls: list[Subtask] = []
    shared_list: list[str] = []

    def planner(_: str) -> list[Subtask]:
        task = Subtask(
            id="A",
            description="a",
            tool_name="mark",
            params={"calls": shared_list, "name": "A"},
            metadata={"tags": ["seed"]},
            depends_on=[],
        )
        planner_calls.append(task)
        return [task]

    workforce = Workforce(
        planner=planner,
        agents={"main": Agent(name="main", toolkit=toolkit)},
        task_router=router,
    )

    first = workforce.execute(task_id="t-first", objective="run")
    second = workforce.execute(task_id="t-second", objective="run")

    assert first.subtasks[0].metadata is not second.subtasks[0].metadata
    assert first.subtasks[0].metadata["routed_agent"] == "main"
    assert second.subtasks[0].metadata["routed_agent"] == "main"
    assert "routed_agent" not in planner_calls[0].metadata
    assert "routed_agent" not in planner_calls[1].metadata


def test_validate_plan_detects_simple_cycle():
    toolkit = Toolkit()
    toolkit.register(SumTool())

    workforce = Workforce(
        planner=lambda _: [
            Subtask(id="A", description="a", tool_name="sum", params={"a": 1, "b": 1}, depends_on=["B"]),
            Subtask(id="B", description="b", tool_name="sum", params={"a": 2, "b": 2}, depends_on=["A"]),
        ],
        agents={"main": Agent(name="main", toolkit=toolkit)},
        task_router=router,
    )

    with pytest.raises(ValueError, match=r"Cycle detected: A -> B -> A"):
        workforce.execute(task_id="t-cycle-simple", objective="run")


def test_validate_plan_detects_larger_cycle():
    toolkit = Toolkit()
    toolkit.register(SumTool())

    workforce = Workforce(
        planner=lambda _: [
            Subtask(id="A", description="a", tool_name="sum", params={"a": 1, "b": 1}, depends_on=["B"]),
            Subtask(id="B", description="b", tool_name="sum", params={"a": 2, "b": 2}, depends_on=["C"]),
            Subtask(id="C", description="c", tool_name="sum", params={"a": 3, "b": 3}, depends_on=["A"]),
        ],
        agents={"main": Agent(name="main", toolkit=toolkit)},
        task_router=router,
    )

    with pytest.raises(ValueError, match=r"Cycle detected: A -> B -> C -> A"):
        workforce.execute(task_id="t-cycle-large", objective="run")


def test_validate_plan_detects_missing_dependency():
    toolkit = Toolkit()
    toolkit.register(SumTool())

    workforce = Workforce(
        planner=lambda _: [
            Subtask(id="A", description="a", tool_name="sum", params={"a": 1, "b": 1}, depends_on=["Z"]),
        ],
        agents={"main": Agent(name="main", toolkit=toolkit)},
        task_router=router,
    )

    with pytest.raises(ValueError, match=r"Dependencies refer to unknown IDs: Z"):
        workforce.execute(task_id="t-missing-dep", objective="run")


def test_validate_plan_detects_duplicate_ids():
    toolkit = Toolkit()
    toolkit.register(SumTool())

    workforce = Workforce(
        planner=lambda _: [
            Subtask(id="A", description="a1", tool_name="sum", params={"a": 1, "b": 1}),
            Subtask(id="A", description="a2", tool_name="sum", params={"a": 2, "b": 2}),
        ],
        agents={"main": Agent(name="main", toolkit=toolkit)},
        task_router=router,
    )

    with pytest.raises(ValueError, match=r"Duplicate subtask IDs: A"):
        workforce.execute(task_id="t-duplicate-ids", objective="run")

def test_execute_raises_value_error_when_static_router_returns_unknown_agent():
    toolkit = Toolkit()
    toolkit.register(SumTool())

    workforce = Workforce(
        planner=lambda _: [Subtask(id="A", description="a", tool_name="sum", params={"a": 1, "b": 2})],
        agents={"main": Agent(name="main", toolkit=toolkit)},
        task_router=lambda _: "ghost",
    )

    with pytest.raises(ValueError, match=r"Invalid initial route for subtask 'A': 'ghost'"):
        workforce.execute(task_id="t-invalid-static-route", objective="run")


def test_dynamic_router_invalid_route_falls_back_and_emits_event():
    toolkit = Toolkit()
    toolkit.register(MarkerTool())
    routed_to = {}

    class RecordingAgent(Agent):
        def execute_subtask(self, task):
            routed_to[task.id] = self.name
            return super().execute_subtask(task)

    workforce = Workforce(
        planner=lambda _: [
            Subtask(id="A", description="a", tool_name="mark", params={"calls": [], "name": "A"}),
            Subtask(id="B", description="b", tool_name="mark", params={"calls": [], "name": "B"}),
        ],
        agents={
            "a": RecordingAgent(name="a", toolkit=toolkit),
            "b": RecordingAgent(name="b", toolkit=toolkit),
        },
        task_router=lambda _: "a",
        dynamic_router=lambda subtask, _context: "invalid-agent" if subtask.id == "B" else "b",
    )

    result = workforce.execute(task_id="t-invalid-dynamic-route", objective="run")

    assert result.status == TaskStatus.COMPLETED
    assert routed_to["A"] == "b"
    assert routed_to["B"] == "a"

    invalid_events = [e for e in result.events if e["type"] == "subtask_reroute_invalid"]
    assert len(invalid_events) == 1
    event = invalid_events[0]
    assert event["subtask_id"] == "B"
    assert event["attempted_agent"] == "invalid-agent"
    assert event["fallback_agent"] == "a"
