#!/usr/bin/env bash

activate_candidate_files() {
  local current_root="$1"
  local candidate_root="$2"
  local rollback_root="$3"

  if [[ ! -d "${current_root}" || ! -d "${candidate_root}" ]]; then
    echo "Bascule impossible : installation ou candidate absente."
    return 1
  fi
  if [[ -e "${rollback_root}" ]]; then
    echo "Bascule impossible : le rollback existe déjà."
    return 1
  fi

  mv "${current_root}" "${rollback_root}"
  if ! mv "${candidate_root}" "${current_root}"; then
    mv "${rollback_root}" "${current_root}"
    return 1
  fi

  mkdir -p "${current_root}/data"
  if [[ -d "${rollback_root}/data" ]]; then
    rm -rf "${current_root}/data"
    mv "${rollback_root}/data" "${current_root}/data"
  fi
}

restore_candidate_files() {
  local current_root="$1"
  local rollback_root="$2"

  if [[ ! -d "${current_root}" || ! -d "${rollback_root}" ]]; then
    echo "Rollback impossible : installation ou point de retour absent."
    return 1
  fi

  if [[ -d "${current_root}/data" ]]; then
    if [[ -e "${rollback_root}/data" ]]; then
      echo "Rollback refusé : deux répertoires de données sont présents."
      return 1
    fi
    mv "${current_root}/data" "${rollback_root}/data"
  fi

  rm -rf "${current_root}"
  mv "${rollback_root}" "${current_root}"
}
