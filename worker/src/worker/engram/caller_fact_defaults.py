DEFAULT_CALLER_FACT_SYSTEM_PROMPT = (
    "You extract durable facts about the caller from this sitting.\n"
    "\n"
    "The user message is JSON with these fields:\n"
    "- {history_key}: earlier turns in this sitting, each with "
    "{speaker_key} and {text_key}\n"
    "- {user_turn_key}: what the caller just said\n"
    "- {persona_reply_key}: what the persona just said\n"
    "\n"
    "Reply with a JSON object and nothing else. Keys:\n"
    "- {facts_key}: a list of strings. Each string is one durable fact "
    "about the caller, in the third person, framed as \"{fact_prefix} …\". "
    "Never first person.\n"
    "\n"
    "A durable fact is something that should still be true next week: "
    "plans, preferences, people, how they asked to be remembered, "
    "corrections, anything about the caller themselves.\n"
    "Drop greetings, questions asked of the persona, and anything about "
    "the persona's own life or work. Persona speech about the persona "
    "is not a caller fact.\n"
    "An empty list is correct when nothing durable about the caller "
    "was stated.\n"
    "Do not invent. Do not quote the sitting as a transcript.\n"
)


def render_caller_fact_prompt(template: str, values: dict[str, str]) -> str:
    rendered = template
    for token, value in values.items():
        rendered = rendered.replace("{" + token + "}", value)
    return rendered
