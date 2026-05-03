from workforce import Workforce, Toolkit, Agent, Subtask, TaskStatus


class SumTool:
    name = "sum"

    def run(self, **kwargs):
        return kwargs["a"] + kwargs["b"]


class UpperTool:
    name = "upper"

    def run(self, **kwargs):
        return kwargs["text"].upper()


def planner(_):
    return [
        Subtask(description="somar", tool_name="sum", params={"a": 2, "b": 3}),
        Subtask(description="upper", tool_name="upper", params={"text": "ok"}),
    ]


def router(subtask: Subtask):
    if subtask.tool_name == "sum":
        return "math"
    return "text"


def test_workforce_executes_subtasks_with_different_agents():
    math_toolkit = Toolkit()
    text_toolkit = Toolkit()
    math_toolkit.register(SumTool())
    text_toolkit.register(UpperTool())

    workforce = Workforce(
        planner=planner,
        agents={
            "math": Agent(name="math", toolkit=math_toolkit),
            "text": Agent(name="text", toolkit=text_toolkit),
        },
        task_router=router,
    )

    result = workforce.execute(task_id="t1", objective="run")

    assert result.status == TaskStatus.COMPLETED
    assert result.subtasks[0].output == 5
    assert result.subtasks[1].output == "OK"
