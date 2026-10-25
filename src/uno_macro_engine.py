"""SigmaOS-office UNO & Macro Scripting Engine (Universal Network Objects / LibreOffice Basic & Python).

Provides service manager, component context, script provider, sandboxed macro runner,
and event dispatch hooks for office automation.

Principles: Inversion of Control, Separation of Concerns, Defensive Programming.
"""

from typing import Dict, Any, Callable, List, Optional
import sys


class XComponentContext:
    """Emulates LibreOffice UNO XComponentContext holding component state and service factory."""
    def __init__(self):
        self._values: Dict[str, Any] = {}
        self.service_manager = XMultiComponentFactory(self)

    def get_value_by_name(self, name: str) -> Any:
        return self._values.get(name)

    def set_value_by_name(self, name: str, value: Any) -> None:
        self._values[name] = value

    def get_service_manager(self) -> "XMultiComponentFactory":
        return self.service_manager


class XMultiComponentFactory:
    """Emulates UNO XMultiComponentFactory for service registration and instantiation."""
    def __init__(self, context: XComponentContext):
        self.context = context
        self._factories: Dict[str, Callable[[XComponentContext], Any]] = {}

    def register_service(self, service_name: str, factory_fn: Callable[[XComponentContext], Any]) -> None:
        self._factories[service_name] = factory_fn

    def create_instance_with_context(self, service_name: str, context: Optional[XComponentContext] = None) -> Any:
        ctx = context or self.context
        if service_name not in self._factories:
            raise KeyError(f"UNO Service '{service_name}' not registered.")
        return self._factories[service_name](ctx)

    def get_available_service_names(self) -> List[str]:
        return sorted(self._factories.keys())


class ScriptContext:
    """Execution context injected into macros (analogous to XSCRIPTCONTEXT in LibreOffice Python)."""
    def __init__(self, component: Any, context: XComponentContext):
        self.component = component
        self.context = context

    def get_document(self) -> Any:
        return self.component

    def get_desktop(self) -> Any:
        return self.context.get_value_by_name("/singletons/com.sun.star.frame.Desktop")


class MacroRunner:
    """Manages and executes user macros and automation routines."""
    def __init__(self, context: Optional[XComponentContext] = None):
        self.context = context or XComponentContext()
        self.scripts: Dict[str, Callable[[ScriptContext], Any]] = {}
        self.event_hooks: Dict[str, List[str]] = {}  # event_name -> list of script names

    def register_script(self, name: str, func: Callable[[ScriptContext], Any]) -> None:
        self.scripts[name] = func

    def bind_event(self, event_name: str, script_name: str) -> None:
        if script_name not in self.scripts:
            raise KeyError(f"Cannot bind unregistered script: {script_name}")
        if event_name not in self.event_hooks:
            self.event_hooks[event_name] = []
        if script_name not in self.event_hooks[event_name]:
            self.event_hooks[event_name].append(script_name)

    def run_script(self, script_name: str, target_component: Any) -> Any:
        if script_name not in self.scripts:
            raise KeyError(f"Macro script '{script_name}' not found.")
        s_ctx = ScriptContext(target_component, self.context)
        return self.scripts[script_name](s_ctx)

    def dispatch_event(self, event_name: str, target_component: Any) -> List[Any]:
        results = []
        for script_name in self.event_hooks.get(event_name, []):
            res = self.run_script(script_name, target_component)
            results.append(res)
        return results

    def execute_snippet(self, code_str: str, target_component: Any) -> Dict[str, Any]:
        """Executes a pure Python snippet in a sandboxed namespace with injected XSCRIPTCONTEXT."""
        s_ctx = ScriptContext(target_component, self.context)
        safe_globals = {
            "__builtins__": {
                "abs": abs, "all": all, "any": any, "bool": bool, "dict": dict,
                "enumerate": enumerate, "filter": filter, "float": float, "int": int,
                "isinstance": isinstance, "len": len, "list": list, "map": map,
                "max": max, "min": min, "range": range, "round": round,
                "sorted": sorted, "str": str, "sum": sum, "tuple": tuple, "zip": zip,
            },
            "XSCRIPTCONTEXT": s_ctx,
            "ThisComponent": target_component,
        }
        local_scope: Dict[str, Any] = {}
        exec(code_str, safe_globals, local_scope)
        return local_scope
