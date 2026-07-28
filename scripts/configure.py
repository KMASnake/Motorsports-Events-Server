#!/usr/bin/env python3
from __future__ import annotations

import argparse
import getpass
import secrets
from pathlib import Path


def ask(label: str, default: str = "", secret: bool = False) -> str:
    suffix = f" [{default}]" if default else ""
    prompt = f"{label}{suffix} : "

    value = getpass.getpass(prompt) if secret else input(prompt)
    value = value.strip()

    return value or default


def yes_no(label: str, default: bool = True) -> bool:
    marker = "O/n" if default else "o/N"
    value = input(f"{label} [{marker}] : ").strip().lower()

    if value == "":
        return default

    return value in {"o", "oui", "y", "yes", "1", "true"}


def random_secret(length: int = 48) -> str:
    return secrets.token_urlsafe(length)


def dotenv_value(value: object) -> str:
    text = str(value)
    must_quote = (
        text == ""
        or any(char.isspace() for char in text)
        or any(char in text for char in '#"\\$`')
    )
    if not must_quote:
        return text

    escaped = (
        text.replace("\\", "\\\\")
        .replace('"', '\\"')
        .replace("\n", "\\n")
        .replace("\r", "\\r")
    )
    return f'"{escaped}"'


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Assistant de configuration Motorsports Events."
    )
    parser.add_argument(
        "--environment",
        choices=["synology", "vps"],
        required=True,
    )
    parser.add_argument("--output", default=".env")
    args = parser.parse_args()

    output = Path(args.output)

    if output.exists():
        replace = yes_no(
            f"{output} existe déjà. Le remplacer",
            default=False,
        )
        if not replace:
            print("Configuration annulée.")
            return

    print()
    print("Motorsports Events Server 2.5.2")
    print("=" * 32)
    print()

    project_name = ask("Nom du projet", "Motorsports Events")
    db_name = ask("Nom de la base PostgreSQL", "motorsport")
    db_user = ask("Utilisateur PostgreSQL", "motorsport")
    db_password = ask(
        "Mot de passe PostgreSQL (vide = génération automatique)",
        "",
        secret=True,
    ) or random_secret(32)

    admin_key = ask(
        "Clé administrateur (vide = génération automatique)",
        "",
        secret=True,
    ) or random_secret(36)

    public_key = ask(
        "Clé API publique (vide = génération automatique)",
        "",
        secret=True,
    ) or random_secret(30)

    season = ask("Saison à synchroniser", "2026")
    timezone = ask("Fuseau horaire", "Europe/Paris")
    interval = ask("Intervalle de synchronisation en minutes", "60")
    import_mode = "all"

    oc_enabled = yes_no("Activer OCBlackTop", True)
    oc_url = ask(
        "URL OCBlackTop",
        "https://api.ocblacktop.com/v1",
    )
    oc_key = ""
    if oc_enabled:
        oc_key = ask("Clé API OCBlackTop", "", secret=True)

    tsdb_enabled = yes_no("Activer TheSportsDB", True)
    tsdb_url = ask(
        "URL TheSportsDB",
        "https://www.thesportsdb.com/api/v1/json",
    )
    tsdb_key = ask("Clé TheSportsDB", "123", secret=True)
    tsdb_leagues = ask(
        "Ligues TheSportsDB",
        "wsbk:4454,wssp:5873",
    )

    values = {
        "PROJECT_NAME": project_name,
        "POSTGRES_DB": db_name,
        "POSTGRES_USER": db_user,
        "POSTGRES_PASSWORD": db_password,
        "DATABASE_URL": (
            f"postgresql+psycopg://{db_user}:{db_password}"
            f"@db:5432/{db_name}"
        ),
        "ADMIN_API_KEY": admin_key,
        "PUBLIC_API_KEY": public_key,
        "OCBLACKTOP_ENABLED": str(oc_enabled).lower(),
        "OCBLACKTOP_BASE_URL": oc_url,
        "OCBLACKTOP_API_KEY": oc_key,
        "OCBLACKTOP_SPORTS": (
            "formula1,formula2,formula3,formula-e,indycar,nascar,"
            "moto-gp,moto2,moto3,wec,wrc"
        ),
        "THESPORTSDB_ENABLED": str(tsdb_enabled).lower(),
        "THESPORTSDB_BASE_URL": tsdb_url,
        "THESPORTSDB_API_KEY": tsdb_key,
        "THESPORTSDB_LEAGUES": tsdb_leagues,
        "SYNC_INTERVAL_MINUTES": interval,
        "SYNC_SEASON": season,
        "SYNC_IMPORT_MODE": import_mode,
        "TIMEZONE": timezone,
        "LOG_LEVEL": "INFO",
    }

    if args.environment == "vps":
        values["API_DOMAIN"] = ask(
            "Nom de domaine principal",
            "motorsports-events.fr",
        )
        values["ACME_EMAIL"] = ask(
            "Adresse email pour le certificat HTTPS",
        )

    output.write_text(
        "\n".join(f"{key}={dotenv_value(value)}" for key, value in values.items()) + "\n",
        encoding="utf-8",
    )
    output.chmod(0o600)

    print()
    print(f"Configuration créée : {output}")
    print("Conservez les clés dans un gestionnaire de mots de passe.")
    print()
    print("Clé administrateur :")
    print(admin_key)
    print()
    print("Clé API publique :")
    print(public_key)


if __name__ == "__main__":
    main()
