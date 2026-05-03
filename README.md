# Meu Orquestrador

Implementação inicial de **Workforce real** com:

- Registro de agentes com toolkits próprios.
- Planejamento e execução de subtarefas.
- Roteamento de subtarefas para agentes específicos.
- Resultado consolidado de execução por tarefa.

## Estruturas principais

- `Toolkit`: registra e executa ferramentas por nome.
- `Agent`: executa subtarefas usando seu toolkit.
- `Subtask`: unidade de execução (descrição, tool, parâmetros, status, saída/erro).
- `Workforce`: recebe objetivo, planeja subtarefas e orquestra execução.
- `WorkforceExecution`: agrega status final da execução.

## Exemplo rápido

```python
from workforce import Workforce, Toolkit, Agent, Subtask

class EchoTool:
    name = "echo"

    def run(self, **kwargs):
        return kwargs.get("text", "")


def planner(objective: str):
    return [Subtask(description="Responder objetivo", tool_name="echo", params={"text": objective})]


def router(subtask: Subtask):
    return "assistant"


toolkit = Toolkit()
toolkit.register(EchoTool())

agent = Agent(name="assistant", toolkit=toolkit)
workforce = Workforce(planner=planner, agents={"assistant": agent}, task_router=router)

result = workforce.execute(task_id="task-1", objective="Olá")
print(result.status)
print(result.subtasks[0].output)
```
