"""Keep inherited application and JVM configuration out of disposable verification."""
PREFIXES = ("SPRING_", "DB_", "SERVER_", "MANAGEMENT_", "MAIL_", "PHOTO_")
OPTIONS = {"JAVA_TOOL_OPTIONS", "JDK_JAVA_OPTIONS", "_JAVA_OPTIONS", "JAVA_OPTS", "GRADLE_OPTS"}


def blocked(name: str) -> bool:
    upper = name.upper().replace(".", "_")
    return upper.startswith(PREFIXES) or upper in OPTIONS


def isolated_environment(source: dict[str, str]) -> dict[str, str]:
    return {name: value for name, value in source.items() if not blocked(name)}
