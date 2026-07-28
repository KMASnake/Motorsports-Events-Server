SPORT_NAMES = {
    "formula1": "Formule 1",
    "formula-1": "Formule 1",
    "formula2": "Formule 2",
    "formula-2": "Formule 2",
    "formula3": "Formule 3",
    "formula-3": "Formule 3",
    "formula-e": "Formule E",
    "indycar": "IndyCar",
    "nascar": "NASCAR",
    "moto-gp": "MotoGP",
    "moto2": "Moto2",
    "moto3": "Moto3",
    "wec": "WEC",
    "wrc": "WRC",
    "wsbk": "WorldSBK",
    "wssp": "WorldSSP",
}


def sport_display_name(sport_id: str) -> str:
    return SPORT_NAMES.get(sport_id, sport_id)
