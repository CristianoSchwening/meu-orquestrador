from workforce import Workforce, Toolkit, Agent, Subtask
from ollama_tool import OllamaTool


class EchoTool:
    name = "echo"

    def run(self, **kwargs):
        return kwargs.get("text", "")


def planner(objective: str):
    return [
        Subtask(id="A", description="Preparar", tool_name="echo", params={"text": objective}),
        Subtask(
            id="B",
            description="Gerar resposta via LLM local",
            tool_name="ollama_generate",
            params={"prompt": f"Resuma em 1 frase: {objective}"},
            depends_on=["A"],
        ),
    ]


def router(_subtask: Subtask):
    return "assistant"


def main() -> None:
    toolkit = Toolkit()
    toolkit.register(EchoTool())
    # Opcional: habilita chamadas locais ao Ollama para testar lógica com LLM gratuito
    toolkit.register(OllamaTool(model="llama3.2:3b"))

    workforce = Workforce(planner=planner, agents={"assistant": Agent(name="assistant", toolkit=toolkit)}, task_router=router)
    result = workforce.execute(task_id="demo", objective="objetivo")

    print("Decision metadata:", result.decision_metadata)
    if not result.decision_metadata["parallelism_worth_it"]:
        print("[AVISO] Paralelismo não compensa para este plano.")


if __name__ == "__main__":
    main()
